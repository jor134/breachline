// The tutorial's lesson menu in VR fits on its panel (buttons below the text).
(async () => {
  const B = window.__bl, wait = ms => new Promise(r => setTimeout(r, ms)); await wait(1500); B.tut.showMenu(); await wait(800);
  return { btns: B.coach.btns.map(b => b.text + '@' + b.y).join(', '), visible: B.coach.mesh.visible };
})()
