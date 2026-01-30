// Comprehensive fallback Q&A system for chatbot
// This provides static responses when OpenAI is unavailable

interface QAPair {
  keywords: string[];
  response: string;
}

const qaDatabase: QAPair[] = [
  // JavaScript/TypeScript
  {
    keywords: ["javascript", "js", "typescript", "ts", "function", "arrow function"],
    response: `**JavaScript Functions:**

Functions are reusable blocks of code. Here are the main types:

1. **Function Declaration:**
\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

2. **Arrow Function:**
\`\`\`javascript
const greet = (name) => \`Hello, \${name}!\`;
\`\`\`

3. **Anonymous Function:**
\`\`\`javascript
const greet = function(name) {
  return \`Hello, \${name}!\`;
};
\`\`\`

**Key Concepts:**
- Functions can accept parameters
- Use \`return\` to output values
- Arrow functions have implicit return for single expressions
- Functions are first-class objects (can be assigned to variables)`
  },
  {
    keywords: ["javascript", "js", "array", "map", "filter", "reduce"],
    response: `**JavaScript Array Methods:**

1. **map()** - Transform each element:
\`\`\`javascript
const numbers = [1, 2, 3];
const doubled = numbers.map(n => n * 2); // [2, 4, 6]
\`\`\`

2. **filter()** - Select elements:
\`\`\`javascript
const evens = numbers.filter(n => n % 2 === 0); // [2]
\`\`\`

3. **reduce()** - Accumulate values:
\`\`\`javascript
const sum = numbers.reduce((acc, n) => acc + n, 0); // 6
\`\`\`

4. **forEach()** - Execute for each element:
\`\`\`javascript
numbers.forEach(n => console.log(n));
\`\`\``
  },
  {
    keywords: ["javascript", "js", "async", "await", "promise"],
    response: `**JavaScript Async/Await:**

**Promises:**
\`\`\`javascript
fetch('/api/data')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error(error));
\`\`\`

**Async/Await (Modern):**
\`\`\`javascript
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}
\`\`\`

**Key Points:**
- \`async\` functions always return a Promise
- \`await\` pauses execution until Promise resolves
- Use \`try/catch\` for error handling`
  },
  
  // Python
  {
    keywords: ["python", "py", "function", "def"],
    response: `**Python Functions:**

\`\`\`python
def greet(name):
    return f"Hello, {name}!"

# With default parameters
def greet(name="World"):
    return f"Hello, {name}!"

# With type hints
def add(a: int, b: int) -> int:
    return a + b

# Lambda (anonymous) functions
square = lambda x: x ** 2
\`\`\`

**Key Concepts:**
- Use \`def\` keyword to define functions
- Indentation defines function body
- \`return\` is optional (returns None if omitted)
- Functions are first-class objects`
  },
  {
    keywords: ["python", "py", "list", "dictionary", "tuple"],
    response: `**Python Data Structures:**

1. **Lists** (mutable):
\`\`\`python
fruits = ["apple", "banana", "cherry"]
fruits.append("orange")
fruits[0] = "apricot"
\`\`\`

2. **Dictionaries** (key-value pairs):
\`\`\`python
person = {"name": "John", "age": 30}
person["city"] = "NYC"
\`\`\`

3. **Tuples** (immutable):
\`\`\`python
coordinates = (10, 20)
x, y = coordinates  # Unpacking
\`\`\`

4. **Sets** (unique elements):
\`\`\`python
unique_numbers = {1, 2, 3, 3}  # {1, 2, 3}
\`\`\``
  },
  
  // Web Development
  {
    keywords: ["html", "css", "web", "dom", "element"],
    response: `**HTML & CSS Basics:**

**HTML Structure:**
\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <title>Page Title</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <h1>Heading</h1>
  <p>Paragraph text</p>
</body>
</html>
\`\`\`

**CSS Styling:**
\`\`\`css
/* Selector */
h1 {
  color: blue;
  font-size: 24px;
  margin: 10px;
}

/* Class selector */
.button {
  background-color: #007bff;
  padding: 10px 20px;
}

/* ID selector */
#header {
  width: 100%;
}
\`\`\``
  },
  {
    keywords: ["react", "component", "props", "state", "hooks"],
    response: `**React Components:**

**Functional Component:**
\`\`\`jsx
function Welcome({ name }) {
  return <h1>Hello, {name}!</h1>;
}
\`\`\`

**With Hooks:**
\`\`\`jsx
import { useState, useEffect } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    document.title = \`Count: \${count}\`;
  }, [count]);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
\`\`\`

**Key Concepts:**
- Components are reusable UI pieces
- Props pass data down
- State manages component data
- Hooks add functionality to functional components`
  },
  
  // Syntax Errors
  {
    keywords: ["syntax error", "syntax", "parse error"],
    response: `**Common Syntax Errors:**

1. **Missing Brackets/Parentheses:**
   - Check all \`(\`, \`[\`, \`{\` have matching closing brackets
   - Use a code editor with bracket matching

2. **Missing Semicolons** (JavaScript):
   - Some languages require semicolons
   - Use a linter to catch these

3. **String Quotes:**
   - Ensure strings start and end with same quote type
   - Escape quotes inside strings: \`"He said \\"Hello\\""\`

4. **Indentation** (Python):
   - Python uses indentation for code blocks
   - Use consistent spacing (4 spaces recommended)

5. **Case Sensitivity:**
   - Variable names are case-sensitive
   - \`myVar\` ≠ \`MyVar\` ≠ \`myvar\`

**Debugging Tips:**
- Read error messages carefully (they show line numbers)
- Check the character before the error location
- Use syntax highlighting in your editor`
  },
  
  // Functions General
  {
    keywords: ["function", "method", "call", "invoke"],
    response: `**Functions Explained:**

A function is a reusable block of code that:
- Takes input (parameters/arguments)
- Performs operations
- Returns output (optional)

**Why use functions?**
- **Reusability**: Write once, use many times
- **Organization**: Break code into logical pieces
- **Maintainability**: Easier to fix and update
- **Testing**: Test individual pieces

**Example:**
\`\`\`javascript
// Define
function calculateArea(width, height) {
  return width * height;
}

// Call/Invoke
const area = calculateArea(5, 10); // 50
\`\`\`

**Best Practices:**
- Give functions descriptive names
- Keep functions focused (single responsibility)
- Use meaningful parameter names
- Document complex functions`
  },
  
  // Variables
  {
    keywords: ["variable", "let", "const", "var", "declaration"],
    response: `**Variables:**

**JavaScript:**
\`\`\`javascript
// let - can be reassigned
let name = "John";
name = "Jane"; // OK

// const - cannot be reassigned
const age = 30;
age = 31; // Error!

// var - old way (avoid in modern code)
var old = "deprecated";
\`\`\`

**Python:**
\`\`\`python
# No declaration needed
name = "John"
age = 30

# Type hints (optional)
name: str = "John"
age: int = 30
\`\`\`

**Naming Rules:**
- Start with letter or underscore
- Can contain letters, numbers, underscores
- Case-sensitive
- Use camelCase (JavaScript) or snake_case (Python)
- Be descriptive: \`userName\` not \`u\``
  },
  
  // Loops
  {
    keywords: ["loop", "for", "while", "iterate"],
    response: `**Loops:**

**JavaScript:**
\`\`\`javascript
// for loop
for (let i = 0; i < 5; i++) {
  console.log(i);
}

// for...of (arrays)
for (const item of array) {
  console.log(item);
}

// for...in (objects)
for (const key in object) {
  console.log(key, object[key]);
}

// while loop
let i = 0;
while (i < 5) {
  console.log(i);
  i++;
}
\`\`\`

**Python:**
\`\`\`python
# for loop
for i in range(5):
    print(i)

# iterate over list
for item in my_list:
    print(item)

# while loop
i = 0
while i < 5:
    print(i)
    i += 1
\`\`\``
  },
  
  // Error Handling
  {
    keywords: ["error", "exception", "try", "catch", "debug"],
    response: `**Error Handling:**

**JavaScript:**
\`\`\`javascript
try {
  // Risky code
  const result = riskyOperation();
  console.log(result);
} catch (error) {
  // Handle error
  console.error("Error occurred:", error.message);
} finally {
  // Always executes
  cleanup();
}
\`\`\`

**Python:**
\`\`\`python
try:
    result = risky_operation()
    print(result)
except ValueError as e:
    print(f"Value error: {e}")
except Exception as e:
    print(f"Error: {e}")
finally:
    cleanup()
\`\`\`

**Debugging Tips:**
1. Read error messages (they tell you what's wrong)
2. Check line numbers in stack traces
3. Use console.log/print to track values
4. Use debugger/breakpoints
5. Isolate the problem (comment out code)`
  },
  
  // Object-Oriented Programming
  {
    keywords: ["class", "object", "oop", "inheritance", "encapsulation"],
    response: `**Object-Oriented Programming:**

**JavaScript Classes:**
\`\`\`javascript
class Person {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }
  
  greet() {
    return \`Hello, I'm \${this.name}\`;
  }
}

const person = new Person("John", 30);
\`\`\`

**Python Classes:**
\`\`\`python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age
    
    def greet(self):
        return f"Hello, I'm {self.name}"

person = Person("John", 30)
\`\`\`

**OOP Concepts:**
- **Encapsulation**: Bundle data and methods together
- **Inheritance**: Create new classes from existing ones
- **Polymorphism**: Same interface, different implementations
- **Abstraction**: Hide complex details`
  },
  
  // API/REST
  {
    keywords: ["api", "rest", "http", "fetch", "endpoint"],
    response: `**APIs & HTTP:**

**HTTP Methods:**
- \`GET\` - Retrieve data
- \`POST\` - Create new resource
- \`PUT\` - Update entire resource
- \`PATCH\` - Partial update
- \`DELETE\` - Remove resource

**JavaScript Fetch:**
\`\`\`javascript
// GET request
fetch('/api/users')
  .then(res => res.json())
  .then(data => console.log(data));

// POST request
fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'John' })
});
\`\`\`

**REST Principles:**
- Stateless (each request independent)
- Resource-based URLs
- Standard HTTP methods
- JSON data format`
  },
];

export function generateChatbotResponse(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>
): string {
  const lowerMessage = userMessage.toLowerCase();
  
  // Search Q&A database
  for (const qa of qaDatabase) {
    if (qa.keywords.some(keyword => lowerMessage.includes(keyword))) {
      return qa.response;
    }
  }
  
  // Pattern-based fallbacks
  if (lowerMessage.includes("python") || lowerMessage.includes("py")) {
    if (lowerMessage.includes("error") || lowerMessage.includes("exception")) {
      return `**Common Python Errors:**

1. **IndentationError**: Python uses indentation for code blocks. Use 4 spaces consistently.

2. **SyntaxError**: Check for:
   - Missing colons (\`:\`) after if/for/while/def
   - Unmatched parentheses, brackets, quotes
   - Incorrect indentation

3. **NameError**: Variable not defined. Check for typos or if variable exists.

4. **TypeError**: Wrong data type operation (e.g., string + int).

5. **IndexError**: List/string index out of range.

6. **KeyError**: Dictionary key doesn't exist.

Share the specific error and I can help fix it!`;
    }
    return `**Python Help:**

Python is a high-level programming language known for:
- Simple, readable syntax
- Indentation-based code blocks
- Dynamic typing
- Extensive standard library

**Common Python Concepts:**
- Variables: \`name = "John"\`
- Functions: \`def greet(name):\`
- Lists: \`items = [1, 2, 3]\`
- Dictionaries: \`data = {"key": "value"}\`
- Loops: \`for item in items:\`

What specific Python topic would you like help with?`;
  }
  
  if (lowerMessage.includes("javascript") || lowerMessage.includes("js")) {
    return `**JavaScript Help:**

JavaScript is a versatile programming language for:
- Web development (frontend & backend)
- Interactive web pages
- Server-side applications (Node.js)

**Key JavaScript Features:**
- Dynamic typing
- First-class functions
- Prototype-based OOP
- Event-driven programming

**Common Topics:**
- Variables: \`let\`, \`const\`, \`var\`
- Functions: arrow functions, async/await
- Arrays: map, filter, reduce
- Objects: properties, methods
- DOM manipulation

What would you like to learn about JavaScript?`;
  }
  
  if (lowerMessage.includes("syntax error") || lowerMessage.includes("syntax")) {
    return `**Fixing Syntax Errors:**

Common syntax issues:
1. **Missing brackets**: \`(\`, \`[\`, \`{\` need matching closers
2. **Semicolons**: Required in some languages (JavaScript)
3. **Quotes**: Strings must start and end with same quote type
4. **Indentation**: Critical in Python
5. **Typos**: Check variable/function names

**Debugging Steps:**
1. Read the error message (it shows the line)
2. Check the character before the error location
3. Use bracket matching in your editor
4. Verify quotes are properly closed

Share your code snippet and I can help identify the issue!`;
  }
  
  if (lowerMessage.includes("debug") || lowerMessage.includes("error")) {
    return `**Debugging Strategies:**

1. **Read Error Messages**: They tell you what's wrong and where
2. **Check Stack Traces**: Shows the call sequence
3. **Add Logging**: Use \`console.log\` or \`print\` to track values
4. **Use Debugger**: Set breakpoints and step through code
5. **Isolate Problem**: Comment out sections to find the issue
6. **Check Data Types**: Verify variables have expected types
7. **Test Incrementally**: Test small pieces before combining

**Common Debugging Tools:**
- Browser DevTools (JavaScript)
- Python debugger (pdb)
- VS Code debugger
- Console/terminal output

Share your error message or code, and I'll help debug it!`;
  }
  
  if (lowerMessage.includes("explain") || lowerMessage.includes("what is") || lowerMessage.includes("how does")) {
    return `I'd be happy to explain! Could you provide more details about:

- What programming concept you want explained?
- A specific code snippet you're working with?
- A term or technology you're unfamiliar with?
- How a particular feature or function works?

The more context you provide, the better I can help!`;
  }
  
  if (lowerMessage.includes("optimize") || lowerMessage.includes("performance")) {
    return `**Code Optimization Tips:**

1. **Algorithm Efficiency**: Choose O(n log n) over O(n²) when possible
2. **Avoid Nested Loops**: Combine operations when possible
3. **Cache Results**: Store computed values that don't change
4. **Use Right Data Structures**: Arrays vs Hash Maps vs Sets
5. **Lazy Loading**: Load data only when needed
6. **Database Optimization**: Use indexes, avoid N+1 queries
7. **Minimize DOM Operations**: Batch updates in JavaScript
8. **Use Memoization**: Cache function results

**Performance Tools:**
- Profilers (Chrome DevTools, Python cProfile)
- Performance monitoring
- Load testing

Share your code and I can provide specific optimization suggestions!`;
  }
  
  // Default response
  return `I'm here to help with your coding questions! I can assist with:

**Programming Concepts:**
• Functions, variables, loops, conditionals
• Data structures (arrays, objects, dictionaries)
• Object-oriented programming
• Async programming

**Languages:**
• JavaScript/TypeScript
• Python
• HTML/CSS
• React and web frameworks

**Common Issues:**
• Syntax errors and debugging
• Code optimization
• Best practices
• API integration

**Ask me about:**
- Specific error messages
- Code snippets you'd like explained
- Programming concepts
- How to implement features
- Best practices

What would you like help with?`;
}


