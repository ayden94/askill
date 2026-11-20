# Pass subprocess arguments as arguments, not shell text

**Invariant:** The child receives the label as one argument; nonzero exit and timeout are failures, not output values.

**Compatibility:** Version-independent recipe on Python 3.9+ for direct execution of the Python interpreter; `capture_output` requires Python 3.7+. Do not generalize this to shell scripts or Windows batch launchers.

## When to read

Read when running an external executable with filenames or other values that may contain spaces or punctuation.

## Decision

Pass an argument vector, check the exit status, and bound the wait. Building a shell command string lets the shell reinterpret separators and split an otherwise ordinary label into multiple arguments.

## Bad

```python
import subprocess
import sys

def rendered_label(label: str) -> str:
    command = f'{sys.executable} -c "import sys; print(sys.argv[1])" {label}'
    return subprocess.getoutput(command)
```

## Good

```python
import os
import subprocess
import sys

def rendered_label(label: str) -> str:
    result = subprocess.run(
        [sys.executable, "-c", "import sys; print(sys.argv[1])", label],
        check=True,
        capture_output=True,
        encoding="utf-8",
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        timeout=5,
    )
    return result.stdout
```

## Assumptions and trade-offs

The executable is the current Python interpreter, and the operation has bounded output. Replace it with a trusted executable in real code and respect that program's own option grammar: an argument vector does not stop its parser treating `-x` as a flag. `capture_output` buffers the full result; use managed streaming for large output. A `run` timeout manages the immediate child, not necessarily its descendants.

## Verification

Run with `"Quarter 1 & 2"` and `"-draft"`; in a scratch variant change the child code to `raise SystemExit(7)`. **Pass:** each valid label is returned unchanged plus a newline; the failing child raises `CalledProcessError` with return code `7` instead of returning diagnostic text as success.
