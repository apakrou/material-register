// Generates a realistic material catalogue. Run with: npm run db:seed
// Deterministic (fixed faker seed) so everyone gets the same data.
import { faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { materials, plants, type MATERIAL_STATUSES, type MATERIAL_TYPES } from "./schema";

const MATERIAL_COUNT = 10_000;

const PLANTS = [
  { code: "1000", name: "Brisbane" },
  { code: "1100", name: "Gladstone" },
  { code: "1200", name: "Mackay" },
  { code: "2000", name: "Sydney" },
  { code: "2100", name: "Newcastle" },
  { code: "3000", name: "Melbourne" },
  { code: "4000", name: "Perth" },
  { code: "4100", name: "Kalgoorlie" },
];

type Template = {
  type: (typeof MATERIAL_TYPES)[number];
  manufacturers: string[];
  description: () => string;
  partNumber: () => string;
  uom: string;
  price: [min: number, max: number];
};

const pick = faker.helpers.arrayElement;
const int = (min: number, max: number) => faker.number.int({ min, max });
const code = (pattern: string) => faker.helpers.replaceSymbols(pattern); // # = digit, ? = letter

// Each template produces one kind of item, e.g. "Bearing, deep groove ball, 25mm bore".
const TEMPLATES: Template[] = [
  // Spare parts
  {
    type: "Spare Part",
    manufacturers: ["SKF", "FAG", "NSK", "Timken", "NTN"],
    description: () => `Bearing, ${pick(["deep groove ball", "spherical roller", "taper roller", "angular contact"])}, ${pick([15, 20, 25, 30, 35, 40, 50, 60])}mm bore`,
    partNumber: () => `${pick(["6", "22", "302", "72"])}${int(10, 99)}${pick(["-2RS", "-ZZ", "E", "CC/W33", "B"])}`,
    uom: "EA",
    price: [12, 950],
  },
  {
    type: "Spare Part",
    manufacturers: ["SKF", "Garlock", "Trelleborg"],
    description: () => { const d = int(20, 120); return `Seal, oil, ${d}x${d + int(10, 30)}x${pick([7, 8, 10, 12])}mm, ${pick(["NBR", "FKM"])}`; },
    partNumber: () => code("CR-#####"),
    uom: "EA",
    price: [4, 120],
  },
  {
    type: "Spare Part",
    manufacturers: ["Gates", "Optibelt", "Fenner"],
    description: () => `Belt, V, ${pick(["SPA", "SPB", "SPZ", "A", "B"])} section, ${int(8, 40) * 50}mm`,
    partNumber: () => code("??-####").toUpperCase(),
    uom: "EA",
    price: [15, 180],
  },
  {
    type: "Spare Part",
    manufacturers: ["WEG", "ABB", "Siemens", "TECO"],
    description: () => `Motor, electric, ${pick([0.75, 1.5, 2.2, 4, 7.5, 11, 15, 22, 37])}kW, ${pick([2, 4, 6])} pole, 415V`,
    partNumber: () => code("M3BP-###-??-#").toUpperCase(),
    uom: "EA",
    price: [450, 12000],
  },
  {
    type: "Spare Part",
    manufacturers: ["Grundfos", "KSB", "Warman", "Flowserve"],
    description: () => `Impeller, centrifugal pump, ${int(10, 45) * 10}mm, ${pick(["cast iron", "stainless 316", "high chrome"])}`,
    partNumber: () => code("IMP-#####-##"),
    uom: "EA",
    price: [300, 8500],
  },
  {
    type: "Spare Part",
    manufacturers: ["Swagelok", "Emerson", "Flowserve", "Keystone"],
    description: () => `Valve, ${pick(["ball", "gate", "butterfly", "check", "globe"])}, ${pick([15, 25, 50, 80, 100, 150])}mm, ${pick(["stainless", "carbon steel", "brass"])}`,
    partNumber: () => code("SS-##??-##").toUpperCase(),
    uom: "EA",
    price: [40, 4200],
  },
  {
    type: "Spare Part",
    manufacturers: ["SICK", "IFM", "Pepperl+Fuchs", "Omron"],
    description: () => `Sensor, ${pick(["proximity, inductive", "photoelectric", "pressure", "temperature, RTD"])}, M${pick([8, 12, 18, 30])}`,
    partNumber: () => code("??####").toUpperCase(),
    uom: "EA",
    price: [60, 900],
  },
  {
    type: "Spare Part",
    manufacturers: ["SEW-Eurodrive", "Flender", "Bonfiglioli"],
    description: () => `Gearbox, ${pick(["helical", "bevel helical", "worm"])}, ratio ${pick([5, 10, 15, 20, 25, 40, 60])}:1`,
    partNumber: () => code("R##DRN##M#").toUpperCase(),
    uom: "EA",
    price: [900, 18000],
  },
  // Consumables
  {
    type: "Consumable",
    manufacturers: ["Parker", "Donaldson", "Pall", "Fleetguard"],
    description: () => `Filter, ${pick(["hydraulic, return line", "air, primary", "fuel", "oil, spin-on"])}, ${pick([3, 5, 10, 25])} micron`,
    partNumber: () => code("P######"),
    uom: "EA",
    price: [18, 350],
  },
  {
    type: "Consumable",
    manufacturers: ["Shell", "Mobil", "Castrol"],
    description: () => pick([
      `Grease, lithium complex, NLGI ${pick([1, 2])}, 450g cartridge`,
      `Oil, hydraulic, ISO VG ${pick([32, 46, 68])}, ${pick([20, 205])}L`,
      `Oil, gear, ISO VG ${pick([150, 220, 320])}, 20L`,
    ]),
    partNumber: () => code("#######"),
    uom: "EA",
    price: [12, 1400],
  },
  {
    type: "Consumable",
    manufacturers: ["Ansell", "3M", "Honeywell"],
    description: () => pick([
      `Gloves, nitrile, size ${pick(["S", "M", "L", "XL"])}`,
      `Respirator, disposable, P2`,
      `Earplugs, foam, uncorded`,
      `Glasses, safety, ${pick(["clear", "tinted"])} lens`,
    ]),
    partNumber: () => code("##-###"),
    uom: "BOX",
    price: [8, 90],
  },
  {
    type: "Consumable",
    manufacturers: ["Lincoln Electric", "CIGWELD", "ESAB"],
    description: () => `Electrode, welding, ${pick(["E6013", "E7018", "E316L"])}, ${pick([2.5, 3.2, 4.0])}mm, 5kg`,
    partNumber: () => code("ED######"),
    uom: "KG",
    price: [25, 160],
  },
  {
    type: "Consumable",
    manufacturers: ["HellermannTyton", "Thomas & Betts"],
    description: () => `Cable tie, nylon, ${pick([100, 200, 300, 450])}mm, ${pick(["black UV", "natural"])}, pack of 100`,
    partNumber: () => code("T##R-PA66-BK"),
    uom: "BOX",
    price: [6, 45],
  },
  // Raw materials
  {
    type: "Raw Material",
    manufacturers: ["BlueScope", "InfraBuild", "Liberty Steel"],
    description: () => `Plate, steel, grade ${pick([250, 350, "Bisalloy 400"])}, ${pick([3, 5, 6, 8, 10, 12, 16, 20])}mm`,
    partNumber: () => code("PL-####-##"),
    uom: "KG",
    price: [2, 9],
  },
  {
    type: "Raw Material",
    manufacturers: ["Atlas Steels", "Sandvik", "Outokumpu"],
    description: () => `Pipe, stainless ${pick([304, 316])}, ${pick([15, 25, 40, 50, 80, 100])} NB, SCH ${pick([10, 40, 80])}`,
    partNumber: () => code("SP###-S##"),
    uom: "M",
    price: [20, 260],
  },
  {
    type: "Raw Material",
    manufacturers: ["Capral", "Ullrich Aluminium"],
    description: () => `Bar, round, aluminium ${pick([6061, 6082, 7075])}, ${pick([10, 20, 25, 40, 50, 75])}mm`,
    partNumber: () => code("AR-####"),
    uom: "M",
    price: [8, 140],
  },
  {
    type: "Raw Material",
    manufacturers: ["Fenner Dunlop", "Trelleborg"],
    description: () => `Sheet, rubber, ${pick(["neoprene", "natural", "EPDM", "nitrile"])}, ${pick([1.5, 3, 6, 10])}mm`,
    partNumber: () => code("RS-###-##"),
    uom: "M",
    price: [15, 220],
  },
  // Tools
  {
    type: "Tool",
    manufacturers: ["Norbar", "Snap-on", "Sidchrome"],
    description: () => `Wrench, torque, ${pick(["3/8in", "1/2in", "3/4in"])} drive, ${pick(["20-100", "40-200", "60-340"])}Nm`,
    partNumber: () => code("TW-#####"),
    uom: "EA",
    price: [180, 1500],
  },
  {
    type: "Tool",
    manufacturers: ["Makita", "Milwaukee", "DeWalt"],
    description: () => `${pick(["Drill", "Impact driver", "Angle grinder, 125mm", "Reciprocating saw"])}, cordless, 18V`,
    partNumber: () => code("??###Z").toUpperCase(),
    uom: "EA",
    price: [150, 700],
  },
  {
    type: "Tool",
    manufacturers: ["Fluke", "Megger"],
    description: () => pick(["Multimeter, digital, CAT III", "Clamp meter, AC/DC, 600A", "Insulation tester, 1kV", "Thermometer, infrared"]),
    partNumber: () => code("###-?").toUpperCase(),
    uom: "EA",
    price: [120, 2400],
  },
  {
    type: "Tool",
    manufacturers: ["Sutton Tools", "Bordo", "Dormer"],
    description: () => `Drill bit set, ${pick(["HSS", "cobalt", "TiN coated"])}, ${pick([13, 19, 25])} piece`,
    partNumber: () => code("D###-SET-##"),
    uom: "SET",
    price: [30, 280],
  },
];

function makeMaterial(index: number, plantIds: number[]) {
  const template = pick(TEMPLATES);
  return {
    materialNumber: `MAT-${String(index + 1).padStart(6, "0")}`,
    description: template.description(),
    materialType: template.type,
    manufacturer: pick(template.manufacturers),
    manufacturerPartNumber: template.partNumber(),
    plantId: pick(plantIds),
    status: faker.helpers.weightedArrayElement<(typeof MATERIAL_STATUSES)[number]>([
      { value: "Active", weight: 80 },
      { value: "Obsolete", weight: 12 },
      { value: "Pending Review", weight: 8 },
    ]),
    unitOfMeasure: template.uom,
    unitPrice: faker.number.float({ min: template.price[0], max: template.price[1], fractionDigits: 2 }).toFixed(2),
    quantityOnHand: faker.helpers.weightedArrayElement([
      { value: 0, weight: 15 },
      { value: int(1, 20), weight: 60 },
      { value: int(21, 500), weight: 25 },
    ]),
    updatedAt: faker.date.past({ years: 3 }),
  };
}

async function main() {
  faker.seed(42);

  // Start from a clean slate so the seed can be re-run safely.
  await db.execute(sql`TRUNCATE ${materials}, ${plants} RESTART IDENTITY CASCADE`);

  const insertedPlants = await db.insert(plants).values(PLANTS).returning({ id: plants.id });
  const plantIds = insertedPlants.map((p) => p.id);

  const rows = Array.from({ length: MATERIAL_COUNT }, (_, i) => makeMaterial(i, plantIds));

  // Insert in batches: one huge INSERT would exceed Postgres' 65,535 parameter limit.
  const BATCH_SIZE = 1000;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await db.insert(materials).values(rows.slice(i, i + BATCH_SIZE));
  }

  console.log(`Seeded ${PLANTS.length} plants and ${rows.length} materials`);
  await db.$client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
