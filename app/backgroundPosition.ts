export const BACKGROUND_POSITION_Y_MIN = -50;
export const BACKGROUND_POSITION_Y_MAX = 50;

export const getBackgroundImageTransform = (positionY: number) => {
  const offset = positionY / 2;
  return `translateY(${offset}%)`;
};
