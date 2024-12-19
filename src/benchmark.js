function benchy() {
  var benchmarkCpuFrame = localStorage.benchmarkCpuFrame | 0;
  var benchmarkRenderFrame = localStorage.benchmarkRenderFrame | 0;

  function benchmark_cpu() {
    var temp = rasterize_line;
    rasterize_line = function () {};

    var doCpuHistogram = localStorage.cpuHistogram || false;
    var temp2 = z80_instruction_hook;
    var histogram = new Uint32Array(256);
    if (doCpuHistogram) {
      z80_instruction_hook = function (pc, opcode) {
        histogram[opcode]++;
      };
    }

    const framesToProfile = localStorage.benchmarkCpuFrames || 1000;
    const lines = 313 * framesToProfile;
    const start = Date.now();
    var totalT = 0;
    var i;
    for (i = 0; i < lines; ++i) {
      line();
      totalT += tstates;
    }
    const end = Date.now();
    const millis = end - start;

    if (doCpuHistogram) {
      var sorted = [];
      for (i = 0; i < 256; ++i) {
        sorted.push([i, histogram[i]]);
      }
      sorted.sort(function (a, b) {
        return b[1] - a[1];
      });
      for (i = 0; i < 30; ++i) {
        console.log(hexbyte(sorted[i][0]) + " - " + sorted[i][1]);
      }
    }
    z80_instruction_hook = temp2;

    console.log("Takes " + millis / lines + "ms/line");
    var frequency = totalT / (millis / 1000);
    console.log("Virtual " + (frequency / 1000 / 1000).toPrecision(4) + "MHz");
    rasterize_line = temp;
  }

  function benchmark_render() {
    const reps = 1000;
    const start = Date.now();
    vdp_current_line = 0;
    for (var i = 0; i < reps; ++i) {
      while ((vdp_hblank() & 4) === 0);
    }
    const end = Date.now();
    console.log("Takes " + (end - start) / reps + "ms/frame");
  }

  function vdp_frame_hook(currentFrame) {
    if (currentFrame === benchmarkCpuFrame) benchmark_cpu();
    if (currentFrame === benchmarkRenderFrame) benchmark_render();
  }

  window.vdp_frame_hook = vdp_frame_hook;
}
benchy();
