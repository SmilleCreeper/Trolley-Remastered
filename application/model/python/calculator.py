import time

import numpy as np

from python_to_framework_bridge import action, progress, screens

_IDLE_HINT = "Try 1 ÷ 0 to see the fallback screen."
_MAX_DIGITS = 15

_OPERATIONS = {
    "+": (np.add, "+", "addition"),
    "-": (np.subtract, "−", "subtraction"),
    "*": (np.multiply, "×", "multiplication"),
    "/": (np.divide, "÷", "division"),
}

_KEY_ACTIONS = {
    ".": "decimal",
    "Enter": "equals",
    "=": "equals",
    "Backspace": "backspace",
    "Escape": "clear",
    "c": "clear",
    "C": "clear",
}


def _format_number(value):
    value = float(value)

    if np.isnan(value):
        return "nan"
    if np.isposinf(value):
        return "inf"
    if np.isneginf(value):
        return "-inf"
    if value == 0:
        return "0"

    text = format(value, ".12g")
    if "e" not in text:
        return text

    mantissa, exponent_text = text.split("e")
    exponent = int(exponent_text)

    if -9 <= exponent < 12:
        decimals = max(0, 11 - exponent)
        return f"{value:.{decimals}f}".rstrip("0").rstrip(".")

    mantissa = mantissa.rstrip("0").rstrip(".")
    return f"{mantissa}e{exponent:+d}"


def _failure_details(left, operator, right, result):
    _, symbol, name = _OPERATIONS[operator]
    operation = f"{_format_number(left)} {symbol} {_format_number(right)}"

    if np.isnan(result):
        if operator == "/" and left == 0 and right == 0:
            reason = "0 ÷ 0 is undefined, so NumPy returned NaN."
        else:
            reason = f"The {name} produced an undefined result (NaN)."
    elif operator == "/" and right == 0:
        reason = "Division by zero produced infinity."
    else:
        reason = (
            f"The {name} overflowed the finite floating-point range and "
            "produced infinity."
        )

    return (
        f"Operation: {operation}\n"
        f"Operator: {name}\n"
        f"Left operand: {_format_number(left)}\n"
        f"Right operand: {_format_number(right)}\n"
        f"Result: {_format_number(result)}\n"
        f"Reason: {reason}"
    )


def _calculate(left, operator, right):
    operation, _, name = _OPERATIONS[operator]

    progress.show("Calculating...")
    progress.update(25, f"Preparing {name}...")
    time.sleep(0.1)

    progress.update(60, "Running NumPy operation...")
    time.sleep(0.1)

    with np.errstate(all="ignore"):
        result = operation(np.float64(left), np.float64(right))

    progress.update(85, "Checking result...")
    time.sleep(0.1)

    if np.isnan(result) or np.isinf(result):
        progress.finish("Result is not finite")
        screens.go(
            "fallback",
            {
                "cause": "Calculator result is not finite",
                "description": (
                    "NumPy returned NaN or infinity, so the calculation was "
                    "stopped before a result was displayed."
                ),
                "details": _failure_details(left, operator, right, result),
            },
        )
        return None

    progress.finish("Complete")
    return float(result)


class Calculator:
    def __init__(self):
        self.reset()

    def reset(self):
        self.display = "0"
        self.accumulator = None
        self.pending_operator = None
        self.waiting_for_operand = False
        self.expression = ""
        self.status = _IDLE_HINT
        self.status_is_error = False

    def snapshot(self):
        return {
            "display": self.display,
            "expression": self.expression,
            "status": self.status,
            "statusIsError": self.status_is_error,
        }

    def _error(self, message):
        self.status = message
        self.status_is_error = True
        return self.snapshot()

    def _clear_status(self):
        self.status = ""
        self.status_is_error = False

    def _display_number(self):
        return float(self.display)

    def _digit_count(self):
        return sum(character.isdigit() for character in self.display)

    def input_digit(self, value):
        if not isinstance(value, str) or len(value) != 1 or not value.isdigit():
            return self._error("Invalid digit.")

        if self.waiting_for_operand:
            self.display = value
            self.waiting_for_operand = False

            if self.pending_operator is None:
                self.expression = ""
        elif self.display == "0":
            self.display = value
        elif self.display == "-0":
            self.display = f"-{value}"
        elif self._digit_count() < _MAX_DIGITS:
            self.display += value

        self._clear_status()
        return self.snapshot()

    def input_decimal(self):
        if self.waiting_for_operand:
            self.display = "0."
            self.waiting_for_operand = False

            if self.pending_operator is None:
                self.expression = ""
        elif "." not in self.display:
            self.display += "."

        self._clear_status()
        return self.snapshot()

    def toggle_sign(self):
        if self.waiting_for_operand:
            self.display = "-0"
            self.waiting_for_operand = False

            if self.pending_operator is None:
                self.expression = ""
        elif self.display != "0":
            if self.display.startswith("-"):
                self.display = self.display[1:]
            else:
                self.display = f"-{self.display}"

        self._clear_status()
        return self.snapshot()

    def backspace(self):
        if self.waiting_for_operand:
            return self.snapshot()

        if self.display.startswith("-"):
            self.display = self.display[:-1] if len(self.display) > 2 else "0"
        else:
            self.display = self.display[:-1] if len(self.display) > 1 else "0"

        self._clear_status()
        return self.snapshot()

    def clear(self):
        self.reset()
        return self.snapshot()

    def input_operator(self, value):
        if value not in _OPERATIONS:
            return self._error(f"Unsupported operator: {value}")

        if self.pending_operator is not None and not self.waiting_for_operand:
            result = _calculate(
                self.accumulator,
                self.pending_operator,
                self._display_number(),
            )

            if result is None:
                return None

            self.accumulator = result
            self.display = _format_number(result)
        else:
            self.accumulator = self._display_number()

        self.pending_operator = value
        self.waiting_for_operand = True
        self.expression = (
            f"{_format_number(self.accumulator)} {_OPERATIONS[value][1]}"
        )

        self._clear_status()
        return self.snapshot()

    def equals(self):
        if self.pending_operator is None:
            return self.snapshot()

        left = self.accumulator
        operator = self.pending_operator
        right = self._display_number()
        result = _calculate(left, operator, right)

        if result is None:
            return None

        self.display = _format_number(result)
        self.expression = (
            f"{_format_number(left)} {_OPERATIONS[operator][1]} "
            f"{_format_number(right)} ="
        )
        self.accumulator = result
        self.pending_operator = None
        self.waiting_for_operand = True

        self._clear_status()
        return self.snapshot()

    def handle_key(self, value):
        if not isinstance(value, str):
            return self.snapshot()

        if len(value) == 1 and value.isdigit():
            return self.input_digit(value)

        action_name = _KEY_ACTIONS.get(value)
        if action_name is not None:
            return self.handle_action(action_name)

        if value in _OPERATIONS:
            return self.input_operator(value)

        return self.snapshot()

    def handle_action(self, value):
        if value == "clear":
            return self.clear()
        if value == "backspace":
            return self.backspace()
        if value == "sign":
            return self.toggle_sign()
        if value == "decimal":
            return self.input_decimal()
        if value == "equals":
            return self.equals()

        return self._error(f"Unsupported calculator action: {value}")

    def handle(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("Calculator payload must be an object.")

        event_type = payload.get("type")
        value = payload.get("value")

        if event_type == "reset":
            return self.clear()
        if event_type == "digit":
            return self.input_digit(value)
        if event_type == "operator":
            return self.input_operator(value)
        if event_type == "key":
            return self.handle_key(value)
        if event_type == "action":
            return self.handle_action(value)

        raise ValueError(f"Unsupported calculator event: {event_type}")


_calculator = Calculator()


@action
def run(payload):
    return _calculator.handle(payload)
