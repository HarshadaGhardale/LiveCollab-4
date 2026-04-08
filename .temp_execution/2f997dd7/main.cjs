
const fs = require('fs');
function prompt(msg) {
  if (msg !== undefined) process.stdout.write(String(msg));
  const buf = Buffer.alloc(1);
  let result = '';
  try {
    while (true) {
      const n = fs.readSync(0, buf, 0, 1, null);
      if (n === 0) break;
      const ch = buf.toString('utf8', 0, n);
      result += ch;
      if (ch === '\n') break;
    }
  } catch { return ''; }
  return result.trimEnd();
}

let input = prompt("Enter a number:");

let num = Number(input);

// Validation
if (isNaN(num)) {
    alert("Invalid input! Please enter a number.");
} else {
    let result = "";

    // Check even/odd
    result += (num % 2 === 0) ? "Even\n" : "Odd\n";

    // Check positive/negative/zero
    if (num > 0) result += "Positive\n";
    else if (num < 0) result += "Negative\n";
    else result += "Zero\n";

    // Check prime
    let isPrime = num > 1;
    for (let i = 2; i <= Math.sqrt(num); i++) {
        if (num % i === 0) {
            isPrime = false;
            break;
        }
    }
    result += isPrime ? "Prime" : "Not Prime";

    alert(result);
}
