const drawer = document.getElementById('side-drawer');
  const drawerTab = document.getElementById('drawer-tab');

  // Toggle drawer on tab click
  drawerTab.addEventListener('click', (event) => {
    event.stopPropagation(); // prevent triggering document click
    drawer.classList.toggle('open');
  });

  // Close drawer if user clicks elsewhere
  document.addEventListener('click', (event) => {
    if (!drawer.contains(event.target)) {
      drawer.classList.remove('open');
    }
  });