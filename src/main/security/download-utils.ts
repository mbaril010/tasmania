export interface ResumeDecision {
  startByte: number;
  writeFlag: 'a' | 'w';
  restartedFromZero: boolean;
}

export function decideResumeBehavior(startByte: number, responseStatus: number): ResumeDecision {
  if (startByte > 0 && responseStatus === 200) {
    return {
      startByte: 0,
      writeFlag: 'w',
      restartedFromZero: true,
    };
  }

  return {
    startByte,
    writeFlag: startByte > 0 ? 'a' : 'w',
    restartedFromZero: false,
  };
}
