export type TrainSchedule = {
  length: number; speed: number; stop: number; dwell: number;
  acceleration: number; braking: number; rampUp: number; rampDown: number;
  accelerateDistance: number; cruiseDistance: number; cruiseTime: number; period: number;
};

/** A periodic distance schedule: the same train returns to its station each lap. */
export function trainSchedule(length:number,speed:number,stop?:number,dwell=4): TrainSchedule {
  if(length<=0||speed<=0)throw new Error('Train length and speed must be positive');
  const acceleration=520,braking=800;
  if(stop===undefined)return {length,speed,stop:0,dwell:0,acceleration,braking,rampUp:0,rampDown:0,accelerateDistance:0,cruiseDistance:length,cruiseTime:length/speed,period:length/speed};
  // A short depot loop may not have enough track to reach the cruising limit.
  const peak=Math.min(speed,Math.sqrt(2*length/(1/acceleration+1/braking)));
  const rampUp=peak/acceleration,rampDown=peak/braking;
  const accelerateDistance=peak*peak/(2*acceleration);
  const cruiseDistance=Math.max(0,length-accelerateDistance-peak*peak/(2*braking));
  const cruiseTime=cruiseDistance/peak;
  return {length,speed:peak,stop,dwell,acceleration,braking,rampUp,rampDown,accelerateDistance,cruiseDistance,cruiseTime,period:dwell+rampUp+cruiseTime+rampDown};
}

export function trainMotion(seconds:number,schedule:TrainSchedule,phase=0) {
  const s=schedule,t=((seconds+phase*s.period)%s.period+s.period)%s.period;
  if(!s.dwell)return {distance:t*s.speed,speed:s.speed};
  if(t<s.dwell)return {distance:s.stop,speed:0};
  const moving=t-s.dwell;
  if(moving<s.rampUp)return {distance:s.stop+0.5*s.acceleration*moving*moving,speed:s.acceleration*moving};
  if(moving<s.rampUp+s.cruiseTime)return {distance:s.stop+s.accelerateDistance+(moving-s.rampUp)*s.speed,speed:s.speed};
  const brakingTime=moving-s.rampUp-s.cruiseTime;
  return {distance:s.stop+s.accelerateDistance+s.cruiseDistance+s.speed*brakingTime-0.5*s.braking*brakingTime*brakingTime,speed:Math.max(0,s.speed-s.braking*brakingTime)};
}
