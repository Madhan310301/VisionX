const GATEWAY_URL = "http://localhost:5000/api";

const testCases = [
  {
    name: "1. Basic lowercase word with spaces",
    input: "⠓⠑⠇⠇⠕⠀⠺⠕⠗⠇⠙",
    expected: "hello world"
  },
  {
    name: "2. Capitalized single word",
    input: "⠠⠓⠑⠇⠇⠕",
    expected: "Hello"
  },
  {
    name: "3. Double capital (all caps) word",
    input: "⠠⠠⠓⠑⠇⠇⠕",
    expected: "HELLO"
  },
  {
    name: "4. Capitalized Grade 2 contraction ('The')",
    input: "⠠⠮",
    expected: "The"
  },
  {
    name: "5. Double capitalized Grade 2 contraction ('THE')",
    input: "⠠⠠⠮",
    expected: "THE"
  },
  {
    name: "6. Multi-digit numbers",
    input: "⠼⠉⠃⠚", // 320 in UEB
    expected: "320"
  },
  {
    name: "7. Basic punctuation and spacing",
    input: "⠠⠓⠑⠇⠇⠕⠂⠀⠠⠺⠕⠗⠇⠙⠲", // "Hello, World."
    expected: "Hello, World."
  },
  {
    name: "8. Grouping Parentheses",
    input: "⠐⠣⠠⠓⠑⠇⠇⠕⠐⠜", // "(Hello)"
    expected: "(Hello)"
  },
  {
    name: "9. Mixed capitalized words and contractions",
    input: "⠠⠮⠀⠠⠽⠀⠯⠀⠠⠭⠀⠿⠀⠠⠵", // "The You and It for As"
    expected: "The You and It for As"
  }
];

async function runQATests() {
  console.log("====================================================");
  console.log("🎯 NEURO-DOT QA TRANSLATION BOUNDARY EDGE CASE TESTS");
  console.log("====================================================\n");

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    try {
      const response = await fetch(`${GATEWAY_URL}/braille/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: tc.input,
          brailleSystem: "ueb_grade2"
        })
      });

      if (!response.ok) {
        console.log(`❌ ${tc.name} failed with HTTP status: ${response.status}`);
        failed++;
        continue;
      }

      const json = await response.json();
      const output = json.correctedText;

      if (output === tc.expected) {
        console.log(`✓ ${tc.name}`);
        console.log(`   Input:    "${tc.input}"`);
        console.log(`   Returned: "${output}" (PASSED)`);
        passed++;
      } else {
        console.log(`❌ ${tc.name}`);
        console.log(`   Input:    "${tc.input}"`);
        console.log(`   Expected: "${tc.expected}"`);
        console.log(`   Returned: "${output}" (FAILED)`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${tc.name} crashed: ${err.message}`);
      failed++;
    }
    console.log("----------------------------------------------------");
  }

  console.log(`\n====================================================`);
  console.log(`🏁 QA TEST SUMMARY:`);
  console.log(`   PASSED: ${passed}`);
  console.log(`   FAILED: ${failed}`);
  console.log(`====================================================`);
}

runQATests();
