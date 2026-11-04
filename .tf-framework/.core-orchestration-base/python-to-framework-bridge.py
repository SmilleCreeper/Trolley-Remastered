"""Bridge from Python actions to the framework.

Python actions are the model layer. They report progress, request screen
changes, and read application manifest values through the objects below. The
JavaScript controller receives those events and updates the view.
"""

import contextvars
from functools import wraps

_current_events = contextvars.ContextVar(
    "python_to_framework_bridge_events",
    default=None,
)
_current_manifest = contextvars.ContextVar(
    "python_to_framework_bridge_manifest",
    default=None,
)


class _Progress:
    def show(self, label="Working..."):
        _emit("progress.show", {"label": str(label)})

    def update(self, percent, message=None):
        _emit(
            "progress.update",
            {
                "percent": percent,
                "message": None if message is None else str(message),
            },
        )

    def finish(self, message=None):
        _emit(
            "progress.finish",
            {"message": None if message is None else str(message)},
        )

    def hide(self):
        _emit("progress.hide", {})

    def reset(self):
        _emit("progress.reset", {})


class _Screens:
    def go(self, name, payload=None):
        """Request a screen change after the current action finishes."""

        if not isinstance(name, str) or not name.strip():
            raise ValueError("Screen name is required.")

        _emit(
            "screens.go",
            {
                "screen": name,
                "payload": payload,
            },
        )


class _Manifest:
    def get(self, key, fallback=None):
        data = _current_manifest.get()

        if not isinstance(data, dict):
            raise RuntimeError(
                "Manifest values are only available while an action is running."
            )

        return data.get(key, fallback)

    def all(self):
        data = _current_manifest.get()

        if not isinstance(data, dict):
            raise RuntimeError(
                "Manifest values are only available while an action is running."
            )

        return dict(data)


progress = _Progress()
screens = _Screens()
manifest = _Manifest()


def _emit(event, data):
    callback = _current_events.get()

    if callback is None:
        raise RuntimeError(
            "Action events are only available while an action is running."
        )

    callback(event, data)


def action(func):
    """Bind the framework event bridge for the duration of an action."""

    @wraps(func)
    def wrapper(payload, events=None, manifest_data=None):
        if events is None:
            return func(payload)

        events_token = _current_events.set(events)
        manifest_token = _current_manifest.set(manifest_data or {})

        try:
            return func(payload)
        finally:
            _current_events.reset(events_token)
            _current_manifest.reset(manifest_token)

    return wrapper
