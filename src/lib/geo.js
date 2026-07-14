// Indian state metadata shared by the Regional Map and creator rows.
// Keys are the state codes stored on creators in the DB (creator.state)
// and used by the map's SVG paths.

// Region hues drawn from the portal theme (context.js) so the map reads as
// part of the same system: accent / green / pink / amber / purple / teal.
export const REGION_COLORS = { north:"#2F3E6B", south:"#1E9E5A", west:"#A8519E", east:"#B5790A", northeast:"#7860D6", central:"#1C9C8C" };
export const REGION_NAMES  = { north:"North", south:"South", west:"West", east:"East", northeast:"North-East", central:"Central" };

export const STATES_META = {
  ch:{name:"Chandigarh",region:"north",lang:"Hindi"},dl:{name:"Delhi",region:"north",lang:"Hindi"},
  hp:{name:"Himachal Pradesh",region:"north",lang:"Hindi"},hr:{name:"Haryana",region:"north",lang:"Hindi"},
  jk:{name:"Jammu & Kashmir",region:"north",lang:"Kashmiri"},pb:{name:"Punjab",region:"north",lang:"Punjabi"},
  rj:{name:"Rajasthan",region:"north",lang:"Hindi"},up:{name:"Uttar Pradesh",region:"north",lang:"Hindi"},
  ut:{name:"Uttarakhand",region:"north",lang:"Hindi"},
  ap:{name:"Andhra Pradesh",region:"south",lang:"Telugu"},ka:{name:"Karnataka",region:"south",lang:"Kannada"},
  kl:{name:"Kerala",region:"south",lang:"Malayalam"},tn:{name:"Tamil Nadu",region:"south",lang:"Tamil"},
  gj:{name:"Gujarat",region:"west",lang:"Gujarati"},mh:{name:"Maharashtra",region:"west",lang:"Marathi"},
  ga:{name:"Goa",region:"west",lang:"Konkani"},
  mp:{name:"Madhya Pradesh",region:"central",lang:"Hindi"},ct:{name:"Chhattisgarh",region:"central",lang:"Hindi"},
  or:{name:"Odisha",region:"east",lang:"Odia"},jh:{name:"Jharkhand",region:"east",lang:"Hindi"},
  wb:{name:"West Bengal",region:"east",lang:"Bengali"},br:{name:"Bihar",region:"east",lang:"Hindi"},
  as:{name:"Assam",region:"northeast",lang:"Assamese"},mn:{name:"Manipur",region:"northeast",lang:"Meitei"},
  nl:{name:"Nagaland",region:"northeast",lang:"English"},ml:{name:"Meghalaya",region:"northeast",lang:"Khasi"},
  sk:{name:"Sikkim",region:"northeast",lang:"Nepali"},ar:{name:"Arunachal Pradesh",region:"northeast",lang:"English"},
  mz:{name:"Mizoram",region:"northeast",lang:"Mizo"},tr:{name:"Tripura",region:"northeast",lang:"Bengali"},
  ld:{name:"Lakshadweep",region:"south",lang:"Malayalam"},an:{name:"Andaman & Nicobar",region:"east",lang:"Hindi"},
  dn:{name:"Dadra & Nagar Haveli",region:"west",lang:"Gujarati"},dd:{name:"Daman & Diu",region:"west",lang:"Gujarati"},
  py:{name:"Puducherry",region:"south",lang:"Tamil"},
};

// creator.state historically held 2-letter codes ("ka") but now stores full
// names ("Karnataka"). stateCode() accepts either and returns the code the
// map's SVG paths / STATES_META keys expect, or null when unknown.
const NAME_TO_CODE = Object.fromEntries(
  Object.entries(STATES_META).map(([code, m]) => [m.name.toLowerCase(), code])
);
export function stateCode(v) {
  if (!v) return null;
  if (STATES_META[v]) return v;
  return NAME_TO_CODE[String(v).trim().toLowerCase()] || null;
}
