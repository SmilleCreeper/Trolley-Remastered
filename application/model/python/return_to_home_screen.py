from python_to_framework_bridge import action, manifest, screens


@action
def run(payload):
    screens.go(manifest.get("defaultScreen", "home"))
