  (function() {
    function kirimError(pesan, stack, extra) {
      try {
        fetch('/api/log-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pesan: String(pesan).substring(0, 500),
            stack: stack ? String(stack).substring(0, 2000) : null,
            url: location.href,
            user_agent: navigator.userAgent,
            user_id: (function() { try { return JSON.parse(localStorage.getItem('kb_user') || 'null')?.id || null; } catch { return null; } })(),
            extra: extra || null
          })
        }).catch(function() {});
      } catch(e) {}
    }

    // Tangkap semua JS error
    window.onerror = function(msg, src, line, col, err) {
      kirimError(msg, err ? err.stack : (src + ':' + line + ':' + col));
      return false;
    };

    // Tangkap Promise rejection yang tidak ter-handle
    window.addEventListener('unhandledrejection', function(e) {
      var reason = e.reason;
      kirimError(
        reason instanceof Error ? reason.message : String(reason),
        reason instanceof Error ? reason.stack : null,
        { type: 'unhandledrejection' }
      );
    });

    window._logError = kirimError; // expose untuk manual logging jika perlu
  })();
