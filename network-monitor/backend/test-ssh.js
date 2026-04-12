const { runMikrotikCommand } = require("./src/services/radioService");

async function test(ip) {
  try {
    const lines = await runMikrotikCommand(ip, "SPN", "20406080spN", "/system resource print");
    console.log("RESOURCES:");
    console.log(lines);

    const rb = await runMikrotikCommand(ip, "SPN", "20406080spN", "/system health print");
    console.log("HEALTH:");
    console.log(rb);

    const reg = await runMikrotikCommand(ip, "SPN", "20406080spN", "/interface wireless registration-table print stats");
    console.log("REGISTRATION:");
    console.log(reg);

  } catch(e) {
    console.log(e);
  }
}

test("10.100.15.82");
