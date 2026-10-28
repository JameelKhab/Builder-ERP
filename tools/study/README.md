# Study authoring tools

These Python files generate the discovery study, not the ERP application. The source was retained from the conversation and adapted to use repository-relative paths and the committed evidence archive.

Use Python 3.10 or later. Install the versions in `requirements.txt` into a local virtual environment. Provide a directory containing `DejaVuSans.ttf` and `DejaVuSans-Bold.ttf`; the default lookup is `/usr/share/fonts/truetype/dejavu`.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r tools/study/requirements.txt
JAKH_STUDY_FONT_DIR=/absolute/path/to/dejavu-fonts .venv/bin/python tools/study/build_report.py
```

Output defaults to `.work/study/output/JAKH-ERP-Read-Only-Study.pdf` plus layout metrics. Set `JAKH_STUDY_OUTPUT_DIR` to change the destination deliberately. There is no upload/deployment operation.

The builder expects the five Python files in this directory and `docs/study/Source-evidence.zip`. No local extraction of that archive is needed. `mapping_data.py` holds the 42-entry mapping, twelve capabilities and task routes; the content files contain the report text and tables.

Before publishing a revised report, inspect rendered pages, verify page references and example calculations, preserve the previous revision, update the study index/manifest and record the result in `docs/project-log.md`. Timestamps in generated PDFs may differ; compare content and layout rather than assuming byte-identical output.
