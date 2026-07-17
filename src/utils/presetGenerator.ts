/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Preset {
  id: string;
  name: string;
  description: string;
  generate: () => { dataUrl: string; mimeType: string };
}

export const presets: Preset[] = [
  {
    id: "physics",
    name: "Relativity & Gravity",
    description: "Classic physics formulas by Einstein and Newton",
    generate: () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1000;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");
      if (!ctx) return { dataUrl: "", mimeType: "image/png" };

      // Draw faint grid (engineering paper background)
      ctx.fillStyle = "#fafbfc";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw title / heading
      ctx.fillStyle = "#475569";
      ctx.font = "italic bold 20px Georgia, 'Times New Roman', serif";
      ctx.fillText("Modern Physics Notes - Section 1.2", 60, 60);

      // Draw Equation 1: E = mc^2
      ctx.fillStyle = "#0f172a";
      ctx.font = "italic 52px Georgia, 'Times New Roman', serif";
      ctx.fillText("E = m c", 150, 190);
      
      // Draw superscript 2
      ctx.font = "italic 32px Georgia, 'Times New Roman', serif";
      ctx.fillText("2", 315, 160);

      // Draw explanation note
      ctx.fillStyle = "#64748b";
      ctx.font = "14px 'JetBrains Mono', monospace";
      ctx.fillText("// Einstein's mass-energy equivalence relation", 150, 230);

      // Draw Equation 2: F = G * m1*m2 / r^2
      ctx.fillStyle = "#0f172a";
      ctx.font = "italic 44px Georgia, 'Times New Roman', serif";
      ctx.fillText("F = G", 150, 360);
      
      // Fraction line
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(280, 345);
      ctx.lineTo(440, 345);
      ctx.stroke();

      // Numerator: m1 m2
      ctx.font = "italic 32px Georgia, 'Times New Roman', serif";
      ctx.fillText("m  m", 295, 330);
      ctx.font = "20px Georgia, 'Times New Roman', serif";
      ctx.fillText("1", 322, 338);
      ctx.fillText("2", 372, 338);

      // Denominator: r^2
      ctx.font = "italic 32px Georgia, 'Times New Roman', serif";
      ctx.fillText("r", 340, 390);
      ctx.font = "italic 20px Georgia, 'Times New Roman', serif";
      ctx.fillText("2", 355, 375);

      // Draw gravity annotation
      ctx.fillStyle = "#64748b";
      ctx.font = "14px 'JetBrains Mono', monospace";
      ctx.fillText("// Newton's law of universal gravitation", 150, 435);

      return { dataUrl: canvas.toDataURL("image/png"), mimeType: "image/png" };
    },
  },
  {
    id: "calculus",
    name: "Calculus & Integrals",
    description: "Fundamental integration & calculus formulas",
    generate: () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1000;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");
      if (!ctx) return { dataUrl: "", mimeType: "image/png" };

      // Draw light lined paper background
      ctx.fillStyle = "#fcfdfa";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "#e8dfd8";
      ctx.lineWidth = 1.5;
      for (let y = 80; y < canvas.height; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      // Margin line
      ctx.strokeStyle = "#fca5a5";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(100, 0);
      ctx.lineTo(100, canvas.height);
      ctx.stroke();

      // Heading
      ctx.fillStyle = "#0369a1";
      ctx.font = "bold 18px Georgia, 'Times New Roman', serif";
      ctx.fillText("Calculus Review sheet", 120, 60);

      // Equation 1: Derivative limit
      ctx.fillStyle = "#0f172a";
      ctx.font = "italic 36px Georgia, 'Times New Roman', serif";
      ctx.fillText("f '(x) = lim", 140, 155);
      
      ctx.font = "italic 16px Georgia, 'Times New Roman', serif";
      ctx.fillText("h   0", 305, 175);
      
      // Draw arrow on canvas
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(320, 170);
      ctx.lineTo(330, 170);
      ctx.lineTo(327, 167);
      ctx.moveTo(330, 170);
      ctx.lineTo(327, 173);
      ctx.stroke();

      // Fraction
      ctx.beginPath();
      ctx.moveTo(355, 145);
      ctx.lineTo(600, 145);
      ctx.stroke();

      ctx.font = "italic 28px Georgia, 'Times New Roman', serif";
      ctx.fillText("f(x + h) - f(x)", 375, 132);
      ctx.fillText("h", 465, 180);

      // Equation 2: Gaussian Integral
      ctx.font = "38px Georgia, 'Times New Roman', serif";
      ctx.fillText("∫", 140, 340); // Integral symbol
      ctx.font = "14px Georgia, 'Times New Roman', serif";
      ctx.fillText("∞", 152, 290);
      ctx.fillText("-∞", 136, 355);

      ctx.font = "italic 36px Georgia, 'Times New Roman', serif";
      ctx.fillText("e      dx  =  √π", 175, 330);
      
      // power of e
      ctx.font = "italic 22px Georgia, 'Times New Roman', serif";
      ctx.fillText("-x", 193, 310);
      ctx.font = "italic 14px Georgia, 'Times New Roman', serif";
      ctx.fillText("2", 212, 302);

      return { dataUrl: canvas.toDataURL("image/png"), mimeType: "image/png" };
    },
  },
  {
    id: "algebra",
    name: "Algebraic Theorems",
    description: "Quadratic formula and Pythagorean theorem",
    generate: () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1000;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");
      if (!ctx) return { dataUrl: "", mimeType: "image/png" };

      // Clean plain background
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Heading
      ctx.fillStyle = "#4f46e5";
      ctx.font = "bold 20px Georgia, 'Times New Roman', serif";
      ctx.fillText("High School Algebra Toolkit", 80, 70);

      // Equation 1: Quadratic formula
      ctx.fillStyle = "#0f172a";
      ctx.font = "italic 40px Georgia, 'Times New Roman', serif";
      ctx.fillText("x =", 120, 195);

      // Fraction
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(195, 182);
      ctx.lineTo(510, 182);
      ctx.stroke();

      // Numerator: -b +- sqrt(b^2 - 4ac)
      ctx.font = "italic 32px Georgia, 'Times New Roman', serif";
      ctx.fillText("-b ± √b", 210, 168);
      // power on b
      ctx.font = "italic 18px Georgia, 'Times New Roman', serif";
      ctx.fillText("2", 308, 153);
      // - 4ac
      ctx.font = "italic 32px Georgia, 'Times New Roman', serif";
      ctx.fillText("- 4ac", 322, 168);
      // line over square root content
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(290, 144);
      ctx.lineTo(410, 144);
      ctx.stroke();

      // Denominator: 2a
      ctx.font = "italic 32px Georgia, 'Times New Roman', serif";
      ctx.fillText("2a", 335, 226);

      // Equation 2: Pythagorean theorem
      ctx.font = "italic 44px Georgia, 'Times New Roman', serif";
      ctx.fillText("a  +  b  =  c", 120, 380);
      
      // Superscripts
      ctx.font = "italic 24px Georgia, 'Times New Roman', serif";
      ctx.fillText("2", 145, 360);
      ctx.fillText("2", 248, 360);
      ctx.fillText("2", 353, 360);

      // Faint geometric right triangle illustration
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(650, 380);
      ctx.lineTo(820, 380);
      ctx.lineTo(820, 230);
      ctx.closePath();
      ctx.stroke();

      // Right angle indicator
      ctx.beginPath();
      ctx.moveTo(805, 380);
      ctx.lineTo(805, 365);
      ctx.lineTo(820, 365);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "italic 22px Georgia, 'Times New Roman', serif";
      ctx.fillText("a", 835, 310);
      ctx.fillText("b", 725, 410);
      ctx.fillText("c", 715, 290);

      return { dataUrl: canvas.toDataURL("image/png"), mimeType: "image/png" };
    },
  },
];
