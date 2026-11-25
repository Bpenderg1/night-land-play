// Phone or computer? A phone's main pointer is a finger (coarse). A laptop
// with a touch screen still counts as a computer, because its main pointer
// is the mouse or trackpad.
export const isTouch = window.matchMedia('(pointer: coarse)').matches;
