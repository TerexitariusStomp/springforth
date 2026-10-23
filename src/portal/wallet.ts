// Browser wallet module — served inline on pages that offer chain
// actions. Framework-free: talks to the injected EIP-1193 provider via
// raw JSON-RPC (eth_requestAccounts / eth_sendTransaction), so no
// bundler, no dependency, nothing custodies — the user's wallet signs.
//
// Flow: click [data-tx-build] button → GET the build endpoint →
// wallet.sendTransaction(to, data, value?) → POST /chain/record.

export function walletScript(): string {
  return `<script>
(function () {
  async function send(btn) {
    var url = btn.getAttribute('data-tx-build');
    var kind = btn.getAttribute('data-tx-kind');
    var entity = btn.getAttribute('data-tx-entity');
    if (!window.ethereum) { btn.textContent = 'no wallet detected'; return; }
    btn.disabled = true; btn.textContent = 'building…';
    try {
      var built = await (await fetch(url)).json();
      if (!built.tx) { btn.textContent = built.error || 'build failed'; btn.disabled = false; return; }
      var accts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      var params = { from: accts[0], to: built.tx.to, data: built.tx.data };
      if (built.tx.value) params.value = built.tx.value;
      btn.textContent = 'sign in wallet…';
      var hash = await window.ethereum.request({
        method: 'eth_sendTransaction', params: [params] });
      btn.textContent = 'recording…';
      var rec = await fetch('/chain/record', { method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ txHash: hash, kind: kind, entityId: entity }) });
      var out = await rec.json();
      btn.textContent = 'submitted ' + hash.slice(0, 10) + '…';
      btn.className = 'done';
    } catch (e) {
      btn.textContent = (e && e.message ? e.message : 'failed').slice(0, 60);
      btn.disabled = false;
    }
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-tx-build]');
    if (b) send(b);
  });
})();
</script>`;
}
