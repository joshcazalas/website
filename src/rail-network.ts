import type { Point } from './paths';

export type RailCircuit = {
  id:string; points:Point[]; radius?:number;
  trains:{cars:number;speed:number;phase:number;stop?:Point;dwell?:number}[];
};

// 32 world pixels = one game tile. The installed locomotive's base limit is
// 1.2 tiles/tick, or 2304px/s at 60 ticks/s. Mainline cruising stays just below it.
// Every route is a closed circuit; the last point connects back to the first.
export const railNetwork: RailCircuit[] = [
  {
    id:'outer-mainline',
    points:[[384,384],[6400,384],[7232,1216],[8256,1216],[8704,1664],[8704,4320],[9792,5408],[10048,5408],[10368,5728],[10368,6944],[10048,7264],[9472,7264],[9088,6816],[7776,5504],[3136,5504],[2240,4608],[2240,3424],[1984,3168],[1984,2336],[1536,1888],[352,1888],[64,1600],[64,704]],
    trains:[{cars:7,speed:1920,phase:0.02},{cars:6,speed:1920,phase:0.52}]
  },
  {
    id:'inner-mainline',
    points:[[384,1760],[1600,1760],[2112,2272],[2112,3104],[2368,3360],[2368,4544],[3200,5376],[7840,5376],[9152,6688],[9408,6944],[9856,6944],[10112,6688],[10112,5920],[8576,4384],[8576,1728],[8192,1344],[7168,1344],[6336,512],[448,512],[192,768],[192,1504]],
    trains:[{cars:6,speed:1760,phase:0.12},{cars:5,speed:1760,phase:0.62}]
  },
  {
    id:'copper-depot',radius:160,
    points:[[512,864],[1696,864],[1888,1056],[1888,1248],[1696,1344],[512,1344],[320,1152],[320,1056]],
    trains:[{cars:5,speed:1280,phase:0.15,stop:[1536,864],dwell:4}]
  },
  {
    id:'east-yard',radius:160,
    points:[[8960,2208],[9120,2368],[9120,3840],[8960,4000],[8832,3872],[8832,2336]],
    trains:[{cars:3,speed:1120,phase:0.55,stop:[9120,3456],dwell:3}]
  },
  {
    id:'steel-depot',
    points:[[3392,5888],[6848,5888],[7296,6336],[7296,7040],[7040,7296],[3456,7296],[3200,7040],[3200,6080]],
    trains:[{cars:6,speed:1600,phase:0.3,stop:[5344,5888],dwell:5}]
  }
];
