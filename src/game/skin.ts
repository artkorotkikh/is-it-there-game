/** Stable cosmetic IDs persisted by the canister. Never affect vehicle physics. */
export interface BusSkin { color: string; wheels: string; decal: string }
export const defaultSkin: BusSkin = {color:'cream',wheels:'stock',decal:'probably'};
export const paintColors = [
  {id:'cream',name:'Old faithful',hex:'#e0d4ad'},
  {id:'mint',name:'Mint condition',hex:'#92bca2'},
  {id:'coral',name:'Hot fix',hex:'#d99079'},
  {id:'blue',name:'Blue screen',hex:'#8aaec5'},
  {id:'violet',name:'Purple patch',hex:'#b1a0c5'},
  {id:'gold',name:'Golden master',hex:'#e5bd70'},
] as const;
export const wheelStyles = [{id:'stock',name:'Factory-ish'},{id:'whitewall',name:'Sunday best'},{id:'rally',name:'Deploy faster'}] as const;
export const decalStyles = [
  {id:'probably',name:'Probably Works',title:'PROBABLY WORKS',subtitle:'Works on my subnet.',footer:'PLEASE DO NOT CLOSE THE BUS.'},
  {id:'ship',name:'Ship It',title:'SHIP IT',subtitle:'It passed locally.',footer:'NO ROLLBACKS. ONLY REVERSE.'},
  {id:'404',name:'Lost & Found',title:'404',subtitle:'Road not found.',footer:'RECALCULATING SINCE LAUNCH.'},
] as const;
export const paintFor = (skin:BusSkin) => paintColors.find(p=>p.id===skin.color) ?? paintColors[0];
export const decalFor = (skin:BusSkin) => decalStyles.find(p=>p.id===skin.decal) ?? decalStyles[0];
