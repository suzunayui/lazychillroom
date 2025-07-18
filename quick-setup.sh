#!/bin/bash
curl -fsSL https://raw.githubusercontent.com/suzunayui/lazychillroom/main/setup-production.sh > /tmp/setup.sh
chmod +x /tmp/setup.sh
/tmp/setup.sh "$@"
