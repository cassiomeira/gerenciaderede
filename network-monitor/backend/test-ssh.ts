import { radioService } from "./src/services/radioService.ts";

async function test(ip: string) {
  try {
    const lines = await radioService.runMikrotikCommand(ip, "SPN", "20406080spN", "/system resource print");
    console.log("=== RESOURCES ===");
    console.log(lines);

    const reg = await radioService.runMikrotikCommand(ip, "SPN", "20406080spN", "/interface wireless registration-table print stats");
    console.log("=== REGISTRATION ===");
    console.log(reg);

  } catch(e) {
    console.log(e);
  }
}

test("10.100.15.82");
