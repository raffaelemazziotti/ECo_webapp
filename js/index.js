const drawer = document.getElementById('side-drawer');
  const drawerTab = document.getElementById('drawer-tab');

  drawerTab.addEventListener('click', () => {
    drawer.classList.toggle('open');
  });