class Camera {
  constructor(width, height) {
    this.x = 0;
    this.y = 0;
    this.width = width;
    this.height = height;
  }

  updateSize(width, height) {
      this.width = width;
      this.height = height;
  }

  follow(target) {
    // Simple camera follow logic, centering the target
    this.x = target.x - this.width / 2;
    this.y = target.y - this.height / 2;
  }
}