#!/usr/bin/env bash
set -Eeuo pipefail
cd /srv/firaao/looprewards
PYTHON=/srv/firaao/looprewards/venv/bin/python

"$PYTHON" manage.py send_reminders
"$PYTHON" manage.py run_payouts
if [[ "${AUTO_PURGE:-0}" == "1" ]]; then
  "$PYTHON" manage.py purge_lapsed --apply
else
  "$PYTHON" manage.py purge_lapsed
fi
