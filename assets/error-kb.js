/**
 * DTSC 520 - what the error means, in this course's words.
 *
 * A LOOKUP, not a language model. Two reasons, and both matter:
 *
 *   1. The AI policy draws a line between asking a model to explain an error and
 *      asking it to do the work. A course-hosted assistant sits exactly on that
 *      line. A lookup cannot be mistaken for one.
 *   2. A lookup cannot be confidently wrong. When it does not recognize
 *      something it says so, which is the behaviour we want a student to copy.
 *
 * Each entry:
 *   type      the exception name as Python prints it
 *   headline  what this error means, in one sentence
 *   causes    ordered list; `sig` is matched against the message text, and a
 *             cause with no `sig` is the catch-all shown when nothing matches
 *   where     module and section that teaches it, for the "go and read" link
 *
 * Causes are ordered by how often they are the answer for a beginner, not by
 * how interesting they are.
 */
window.DTSC_ERROR_KB = {

  SyntaxError: {
    headline: "Python could not parse the line at all. Nothing ran.",
    where: { module: 2, section: "errors", label: "Module 2 - Reading errors" },
    causes: [
      { sig: /invalid syntax/i,
        what: "Very often the mistake is on the line ABOVE the one reported.",
        fix: "Python reads until something cannot possibly continue, then complains where it gave up. Check the previous line for a missing closing bracket or quote." },
      { sig: /expected ':'|expected ':'/i,
        what: "A missing colon.",
        fix: "Every `def`, `if`, `elif`, `else`, `for` and `while` header ends in a colon." },
      { sig: /unterminated string|EOL while scanning/i,
        what: "A quote was opened and never closed.",
        fix: "Find the string that starts on that line and close it. Mixing ' and \" is the usual cause." },
      { sig: /cannot assign to literal|invalid decimal/i,
        what: "Assigning to something that is not a name.",
        fix: "`5 = x` is not legal. The name goes on the left." },
      { what: "Something in the line is not valid Python.",
        fix: "Read the caret in the message: it points at where Python stopped understanding, which is at or just after the real mistake." }
    ]
  },

  IndentationError: {
    headline: "The indenting does not line up, and in Python indenting is syntax.",
    where: { module: 2, section: "functions", label: "Module 2 - Functions" },
    causes: [
      { sig: /expected an indented block/i,
        what: "A header ended in a colon but nothing was indented under it.",
        fix: "The body of a `def`, `if` or `for` must be indented. An empty body needs `pass`." },
      { sig: /unexpected indent/i,
        what: "A line is indented that should not be.",
        fix: "Line it up with the statement it belongs to." },
      { what: "Mixed tabs and spaces, most likely.",
        fix: "Use four spaces everywhere. The mix is invisible on screen, which is what makes it maddening." }
    ]
  },

  NameError: {
    headline: "You used a name Python has never been given a value for.",
    where: { module: 2, section: "variables", label: "Module 2 - Variables and types" },
    causes: [
      { sig: /is not defined/i,
        what: "In a notebook, this is usually cells run out of order.",
        fix: "The cell that creates the name has not run yet, or was run and then the kernel restarted. Kernel -> Restart & Run All settles it. If the name is spelled differently where you created it, that is the other half of the answer." },
      { what: "A typo, or a string missing its quotes.",
        fix: "`print(hello)` looks for a variable called hello; `print(\"hello\")` prints the word." }
    ]
  },

  TypeError: {
    headline: "The operation is fine, but not on these types.",
    where: { module: 2, section: "variables", label: "Module 2 - Values and types" },
    causes: [
      { sig: /can only concatenate str|unsupported operand type\(s\) for \+: 'int' and 'str'|must be str, not/i,
        what: "Adding a string to a number.",
        fix: "Convert explicitly - `str(gpa)` - or better, use an f-string: `f\"GPA {gpa}\"`." },
      { sig: /'<' not supported between instances of 'NoneType'/i,
        what: "Comparing a missing value with a number.",
        fix: "A real extract has holes. Guard with `if value is None: continue` before comparing. Module 4 section 8 is about exactly this." },
      { sig: /'NoneType' object (?:is not subscriptable|is not iterable|has no len)/i,
        what: "Something returned None where you expected a value.",
        fix: "A function that PRINTS but does not RETURN gives back None. This is the single most common source of None in this course - Module 2, Functions." },
      { sig: /takes \d+ positional argument|missing \d+ required positional/i,
        what: "Wrong number of arguments.",
        fix: "The message names the function and counts what it wanted against what it got." },
      { sig: /object is not callable/i,
        what: "You put parentheses after something that is not a function.",
        fix: "Usually a name was reassigned - `list = [1,2]` then `list(...)`." },
      { sig: /unsupported operand type\(s\)/i,
        what: "Arithmetic on a column that is text.",
        fix: "Check `.dtype`. `object` means strings got in. Module 4 section 7 - strip and `.astype(float)`." },
      { what: "Check the types before the operation.",
        fix: "`print(type(x))` answers a startling proportion of TypeErrors in one line." }
    ]
  },

  ValueError: {
    headline: "The type is right, the value is not.",
    where: { module: 3, section: "errors", label: "Module 3 - Reading NumPy errors" },
    causes: [
      { sig: /truth value of a (Series|array|DataFrame) is ambiguous/i,
        what: "You used `and`, `or` or `if` on a whole Series or array.",
        fix: "A hundred booleans cannot collapse to one True or False. Use `&` and `|` between conditions, parenthesise each one, or reduce with `.any()` / `.all()`." },
      { sig: /could not convert string to float|invalid literal for int/i,
        what: "A value that looks numeric is not.",
        fix: "Something non-numeric is in there - a stray '%', 'N/A', or an empty string. Look at the actual values before converting." },
      { sig: /could not broadcast|operands could not be broadcast/i,
        what: "Shapes that cannot be stretched to match.",
        fix: "Print `.shape` on both sides. Module 3's broadcasting section, and `np.newaxis` when a dimension needs adding." },
      { sig: /axis \d+ is out of bounds/i,
        what: "You asked for an axis the array does not have.",
        fix: "A 1-D array has only `axis=0`. `.ndim` tells you how many there are." },
      { what: "The value is the wrong shape, range or format for this operation.",
        fix: "Print the thing you are passing in before you pass it." }
    ]
  },

  KeyError: {
    headline: "You asked for a label that does not exist.",
    where: { module: 4, section: "selection", label: "Module 4 - Selection" },
    causes: [
      { sig: /^['\"]?\d+['\"]?$/,
        what: "A number as a key, on a DataFrame read from a file.",
        fix: "`read_csv` gives a RangeIndex, so the labels are 0..n-1 and your id is a COLUMN. Use `df[df.student_id == 1003]`, or `set_index(\"student_id\")` first. Worse: `df.loc[7]` will SUCCEED and return the wrong student. Module 4 section 4." },
      { what: "A column name that does not match.",
        fix: "Case and whitespace count. `df.columns.tolist()` settles it, and `df.columns.str.strip()` fixes headers that arrived with spaces." }
    ]
  },

  IndexError: {
    headline: "You asked for a position that is not there.",
    where: { module: 2, section: "data-structures", label: "Module 2 - Lists" },
    causes: [
      { sig: /list index out of range/i,
        what: "Counting from one instead of zero, or looping one step too far.",
        fix: "The last item of a list of 10 is `xs[9]`. `range(len(xs))` gives the right positions." },
      { sig: /single positional indexer is out-of-bounds/i,
        what: "`.iloc` past the end of the frame.",
        fix: "`.iloc` is position, not label. `df.iloc[1003]` wants the 1004th row. You probably wanted `.loc`." },
      { what: "The collection is shorter than you think.",
        fix: "Print `len()` first." }
    ]
  },

  AttributeError: {
    headline: "That object does not have the thing you asked it for.",
    where: { module: 2, section: "errors", label: "Module 2 - Reading errors" },
    causes: [
      { sig: /'NoneType' object has no attribute/i,
        what: "The object is None, so the real problem happened earlier.",
        fix: "Find where it became None. A function that prints instead of returning, or an `inplace=True` call that gave back nothing." },
      { sig: /'(str|int|float|list|dict)' object has no attribute/i,
        what: "Right method, wrong type.",
        fix: "`.append` is a list method, `.upper` is a string method. `print(type(x))` tells you what you are actually holding." },
      { what: "A typo, or a method that belongs to a different library.",
        fix: "Check spelling first, then check you are holding the object you think you are - `print(type(x))`." }
    ]
  },

  ModuleNotFoundError: {
    headline: "Python cannot find that library.",
    where: { module: 2, section: "modules", label: "Module 2 - Modules" },
    causes: [
      { what: "It is not installed, or Jupyter is using a different Python than you installed it into.",
        fix: "`!pip install <name>` from inside the notebook installs into the Python the notebook is actually using, which is the version that matters. If it still fails, the kernel is probably not the environment you think." }
    ]
  },

  ZeroDivisionError: {
    headline: "Something divided by zero.",
    where: { module: 2, section: "getting-started", label: "Module 2 - Python as a calculator" },
    causes: [
      { what: "Usually an empty collection, not a literal zero.",
        fix: "`total / len(xs)` when `xs` is empty. Guard with `if len(xs):` before averaging." }
    ]
  },

  FileNotFoundError: {
    headline: "The path is not where Python is looking.",
    where: { module: 4, section: "loading", label: "Module 4 - Loading the extract" },
    causes: [
      { what: "The notebook's working directory is not the folder you think.",
        fix: "Paths are relative to where Jupyter was started, not to where the notebook file lives. `import os; print(os.getcwd())` tells you where you are. Start Jupyter from the `notebooks` folder, or use a full path." }
    ]
  }
};

/**
 * Errors that are not errors. Module 4 section 13 - the failures that raise
 * nothing at all and hand back a wrong answer instead. These cannot be looked
 * up from a traceback, because there is no traceback, so they are listed for
 * browsing rather than matched.
 */
window.DTSC_QUIET_FAILURES = [
  { title: "You assigned, and nothing changed",
    tell: "`df[mask][\"col\"] = value` - two bracket pairs before the `=`",
    what: "The first bracket builds a new temporary frame. You edited that, and it was thrown away.",
    fix: "One `.loc` doing both axes: `df.loc[mask, \"col\"] = value`.",
    where: { module: 4, section: "cleaning", label: "Module 4 - Cleaning" } },

  { title: "A merge changed the row count",
    tell: "More rows after a join than before",
    what: "The key was not unique on one side, so each match multiplied.",
    fix: "Check `df.student_id.is_unique` BEFORE merging. And check the row count after every merge - if it fell, an inner join dropped people.",
    where: { module: 4, section: "combining", label: "Module 4 - Merging" } },

  { title: "A statistic quietly skipped the missing values",
    tell: "`.mean()`, `.sum()`, `value_counts()` all ignore NaN by default",
    what: "The number is real but computed over fewer rows than you think.",
    fix: "The count a statistic was computed over is part of the statistic. `df[col].notna().sum()` tells you, and `value_counts(dropna=False)` shows the gap.",
    where: { module: 4, section: "errors", label: "Module 4 - Errors you will hit" } },

  { title: "Arrays that came apart",
    tell: "Sorting one array and not the others",
    what: "Every value is still a valid number, and every one is now attached to the wrong student.",
    fix: "This is why pandas exists. A DataFrame moves the whole row together.",
    where: { module: 4, section: "overview", label: "Module 4 - Why pandas exists" } },

  { title: "dropna() made the answer look better",
    tell: "The average went up after cleaning",
    what: "Missing data is only harmless when it is missing at random. In this cohort it is not - the students without engagement records score lower.",
    fix: "Compare the groups before deciding. Filling and dropping both have costs; pick one deliberately and write down which.",
    where: { module: 4, section: "cleaning", label: "Module 4 - The missing values" } }
];
