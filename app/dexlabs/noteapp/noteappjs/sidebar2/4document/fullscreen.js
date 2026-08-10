export function toggleFullscreen() {
  const e = document.documentElement;
  !document.fullscreenElement &&
  !document.webkitFullscreenElement &&
  !document.msFullscreenElement
    ? e.requestFullscreen
      ? e.requestFullscreen()
      : e.webkitRequestFullscreen
      ? e.webkitRequestFullscreen()
      : e.msRequestFullscreen && e.msRequestFullscreen()
    : document.exitFullscreen
    ? document.exitFullscreen()
    : document.webkitExitFullscreen
    ? document.webkitExitFullscreen()
    : document.msExitFullscreen && document.msExitFullscreen();
}
