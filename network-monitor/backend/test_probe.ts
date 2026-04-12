import ping from 'ping';
async function test() {
  const r = await ping.promise.probe('10.1.15.35', { timeout: 3 });
  console.log(r);
}
test();
