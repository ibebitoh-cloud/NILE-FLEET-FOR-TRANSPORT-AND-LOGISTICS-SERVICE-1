    try {
      const operations = db.getOperations();
      const gensets = db.getStock();
      const invoices = db.getInvoices();
      const maintenance = db.getMaintenanceLogs();
      const q = question.toUpperCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');

      // FAST PATH: factual operational questions never go through the LLM.
      const idMatch = q.match(/(?:GENSET|GENSETS|مولد|مولدات|GENSET\s*ID)\s*#?\s*([A-Z0-9-]+)/i);
      const bookingMatch = q.match(/(?:BOOKING|BOOKING NO|BOOKING NUMBER|حجز)\s*#?\s*([A-Z0-9-]+)/i);
      const containerMatch = q.match(/(?:CONTAINER|CONT|حاويه|حاوية)\s*#?\s*([A-Z0-9]{4,12})/i);
      const searchMatch = q.match(/(?:SEARCH|FIND|WHERE IS|LOCATE|LOOK FOR|ابحث|فين|اين|أين)\s*#?\s*([A-Z0-9-]+)/i);
      const countWords = /HOW MANY|HOW MUCH|NUMBER OF|كام|عدد|كم/.test(q);

      const normalizeId = (value: unknown) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const numericId = (value: unknown) => normalizeId(value).replace(/\\D/g, '');
      const gensetAliases = (value: unknown) => {
        const raw = normalizeId(value);
        const digits = numericId(value);
        const aliases = new Set<string>();
        if (raw) aliases.add(raw);
        if (digits) {
          aliases.add(digits);
          aliases.add(digits.slice(-4).padStart(4, '0'));
          aliases.add(digits.slice(-4));
        }
        return aliases;
      };
      const gensetMatches = (value: string, g: any) => {
        const queryAliases = gensetAliases(value);
        const recordValues = [g?.gensetNumber, g?.unitNumber, g?.id, g?.assetNumber];
        return recordValues.some(v => {
          const aliases = gensetAliases(v);
          return [...queryAliases].some(a => aliases.has(a));
        });
      };
      const operationGensetMatches = (value: string, o: any) => gensetMatches(value, o);
      const dateValue = (x: any) => String(x?.clipOnDate || x?.operationDate || x?.dateReceived || '');
      const fmtOp = (op: any) => {
        const port = op.clipOnPort || op.clipOffPort || '—';
        return isAr
          ? `الحالة: ${op.status || 'غير محدد'}\nالميناء: ${port}\nالحجز: ${op.bookingNumber || '—'}\nالحاوية: ${op.containerNumber || '—'}`
          : `Status: ${op.status || '—'}\nPort: ${port}\nBooking: ${op.bookingNumber || '—'}\nContainer: ${op.containerNumber || '—'}`;
      };

      // Genset lookup searches BOTH the fleet table's unitNumber and operation history.
      // The original genset number is never changed; the last 4 digits are only an alias.
      const lookupGenset = (id: string) => {
        const stockHits = gensets.filter(g => gensetMatches(id, g));
        const opHits = operations
          .filter(o => operationGensetMatches(id, o))
          .sort((a, b) => dateValue(b).localeCompare(dateValue(a)));
        const maintenanceHits = maintenance
          .filter(m => gensetMatches(id, m))
          .sort((a, b) => String(b.serviceDate || '').localeCompare(String(a.serviceDate || '')));
        return { stockHits, opHits, maintenanceHits };
      };

      const answerGenset = (id: string) => {
        const { stockHits, opHits, maintenanceHits } = lookupGenset(id);
        const stock = stockHits[0];
        const latestOp = opHits[0];
        const latestMaintenance = maintenanceHits[0];
        if (!stock && !latestOp && !latestMaintenance) {
          return isAr ? `المولد ${id} غير موجود في بيانات الأسطول أو السجل التشغيلي.` : `GENSET ${id} was not found in fleet, operations, or maintenance records.`;
        }
        const stockNumber = stock?.unitNumber || stock?.gensetNumber || id;
        const location = stock?.location || latestOp?.clipOnPort || latestOp?.clipOffPort || latestMaintenance?.location || '—';
        const status = stock?.status || latestOp?.status || latestMaintenance?.status || '—';
        if (isAr) {
          return `المولد ${stockNumber}\nالحالة: ${status}\nالموقع: ${location}${latestOp ? `\nالحجز: ${latestOp.bookingNumber || '—'}\nالحاوية: ${latestOp.containerNumber || '—'}` : ''}${latestMaintenance ? `\nآخر صيانة: ${latestMaintenance.serviceDate || '—'}` : ''}`;
        }
        return `GENSET ${stockNumber}\nStatus: ${status}\nLocation: ${location}${latestOp ? `\nBooking: ${latestOp.bookingNumber || '—'}\nContainer: ${latestOp.containerNumber || '—'}` : ''}${latestMaintenance ? `\nLast maintenance: ${latestMaintenance.serviceDate || '—'}` : ''}`;
      };

      if (idMatch) {
        setAiChatMessages(prev => [...prev, { role: 'ai', text: answerGenset(idMatch[1]) }]);
        return;
      }

      // "SEARCH 422", "FIND 422", and "WHERE IS 422" are treated as genset IDs
      // when the identifier is short/numeric, so they never fall through to the LLM.
      if (searchMatch) {
        const value = searchMatch[1];
        if (/^\d{1,6}$/.test(value)) {
          setAiChatMessages(prev => [...prev, { role: 'ai', text: answerGenset(value) }]);
          return;
        }
      }

      if (bookingMatch || containerMatch) {
        const value = (bookingMatch?.[1] || containerMatch?.[1] || '').toUpperCase();
        const hits = operations.filter(o =>
          String(o.bookingNumber || '').toUpperCase() === value ||
          String(o.containerNumber || '').toUpperCase() === value
        );
        const answer = hits.length
          ? hits.slice(0, 5).map(fmtOp).join('\n\n')
          : (isAr ? `لم أجد ${value} في العمليات المسجلة.` : `No recorded operation was found for ${value}.`);
        setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        return;
      }

      // Fast count/status questions.
      if (countWords && /GENSET|مولد|STOCK|مخزون|MAINTENANCE|صيانة|PREORDER|UNDER OPERATE|تحت التشغيل/.test(q)) {
        const portMatch = q.match(/DAM|ALEX|GOUDA|SOKHNA|SCCT|PSD|MAL/);
        let list = gensets;
        if (portMatch) list = list.filter(g => String(g.location || '').toUpperCase() === portMatch[0]);
        const maintenanceCount = list.filter(g => g.status === 'MAINTENANCE').length;
        const stockCount = list.filter(g => g.status === 'IN_STOCK').length;
        const answer = isAr
          ? `العدد: ${list.length}\nالمخزون: ${stockCount}\nالصيانة: ${maintenanceCount}${portMatch ? `\nالميناء: ${portMatch[0]}` : ''}`
          : `Total: ${list.length}\nIn stock: ${stockCount}\nMaintenance: ${maintenanceCount}${portMatch ? `\nPort: ${portMatch[0]}` : ''}`;
        setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        return;
      }

      // Fast customer/operation lookup: factual questions stay local and never wait for AI.
      const customerQuery = q.match(/(?:HOW MANY|COUNT|NUMBER OF|كام|عدد|كم).*?(?:OPERATIONS?|JOBS?|عمليه|عمليات).*?(?:FOR|ل|لل)?\s*([A-Z][A-Z0-9 .&_-]{2,})$/i);
      if (customerQuery) {
        const needle = customerQuery[1].trim().toUpperCase();
        const hits = operations.filter(o => String(o.customerName || '').toUpperCase().includes(needle));
        const answer = isAr ? `عدد العمليات لـ ${needle}: ${hits.length}` : `Operations for ${needle}: ${hits.length}`;
        setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        return;
      }

      // Only genuine analysis/reasoning reaches DALI. Keep the model payload tiny.