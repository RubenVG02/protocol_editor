{
  "class": "Workflow",
  "cwlVersion": "v1.2",
  "doc": "High-accuracy PDF OCR workflow using official Chandra CLI in HF mode. Produces editable OCR outputs and a faithful PDF viewer HTML. GGUF-related inputs are retained for backward compatibility but ignored.",
  "label": "Chandra PDF OCR (Editable + Faithful View)",
  "$namespaces": {
    "sbg": "https://sevenbridges.com"
  },
  "inputs": [
    {
      "id": "PDF",
      "sbg:fileTypes": "PDF",
      "type": "File",
      "label": "Input PDF",
      "doc": "PDF document to OCR."
    },
    {
      "id": "HF_Model_ID",
      "type": "string?",
      "label": "HuggingFace model id",
      "doc": "Used in HF mode when Local_Model_Snapshot is not provided.",
      "default": "datalab-to/chandra-ocr-2"
    },
    {
      "id": "Local_Model_Snapshot",
      "type": "Directory?",
      "label": "Local HF model snapshot (optional)",
      "doc": "Optional local folder with a pre-downloaded Hugging Face snapshot."
    },
    {
      "id": "Use_GGUF",
      "type": "boolean?",
      "label": "Use GGUF mode",
      "doc": "Deprecated compatibility input. Ignored in simplified CLI mode.",
      "default": false
    },
    {
      "id": "GGUF_Model",
      "type": "File?",
      "label": "GGUF model file (deprecated)",
      "doc": "Deprecated compatibility input. Ignored in simplified CLI mode."
    },
    {
      "id": "GGUF_Repo",
      "type": "string?",
      "label": "GGUF Hugging Face repo (deprecated)",
      "default": "prithivMLmods/chandra-ocr-2-GGUF"
    },
    {
      "id": "GGUF_File",
      "type": "string?",
      "label": "GGUF filename (deprecated)",
      "default": "chandra-ocr-2.F32.gguf"
    },
    {
      "id": "GGUF_MMProj",
      "type": "File?",
      "label": "GGUF mmproj file (deprecated)",
      "doc": "Deprecated compatibility input. Ignored in simplified CLI mode."
    },
    {
      "id": "GGUF_MMProj_Repo",
      "type": "string?",
      "label": "GGUF mmproj Hugging Face repo (deprecated)",
      "default": "prithivMLmods/chandra-ocr-2-GGUF"
    },
    {
      "id": "GGUF_MMProj_File",
      "type": "string?",
      "label": "GGUF mmproj filename (deprecated)",
      "doc": "Deprecated compatibility input. Ignored in simplified CLI mode."
    },
    {
      "id": "Prompt_Type",
      "type": "string?",
      "label": "Prompt type",
      "doc": "Deprecated compatibility input. Ignored in simplified CLI mode.",
      "default": "ocr_layout"
    },
    {
      "id": "Max_New_Tokens",
      "type": "int?",
      "label": "Max new tokens per page",
      "default": 8192
    },
    {
      "id": "GGUF_Ctx",
      "type": "int?",
      "label": "GGUF context window",
      "doc": "Deprecated compatibility input. Ignored in simplified CLI mode.",
      "default": 32768
    },
    {
      "id": "Render_DPI",
      "type": "int?",
      "label": "PDF render DPI",
      "doc": "Deprecated compatibility input. Ignored in simplified CLI mode.",
      "default": 220
    }
  ],
  "outputs": [
    {
      "id": "OCR_Results",
      "outputSource": [
        "run_chandra_ocr/ocr_results"
      ],
      "type": "Directory"
    },
    {
      "id": "Run_Log",
      "outputSource": [
        "run_chandra_ocr/run_log"
      ],
      "type": "File"
    }
  ],
  "steps": [
    {
      "id": "run_chandra_ocr",
      "in": [
        {
          "id": "PDF",
          "source": "PDF"
        },
        {
          "id": "HF_Model_ID",
          "source": "HF_Model_ID"
        },
        {
          "id": "Local_Model_Snapshot",
          "source": "Local_Model_Snapshot"
        },
        {
          "id": "Use_GGUF",
          "source": "Use_GGUF"
        },
        {
          "id": "GGUF_Model",
          "source": "GGUF_Model"
        },
        {
          "id": "GGUF_Repo",
          "source": "GGUF_Repo"
        },
        {
          "id": "GGUF_File",
          "source": "GGUF_File"
        },
        {
          "id": "GGUF_MMProj",
          "source": "GGUF_MMProj"
        },
        {
          "id": "GGUF_MMProj_Repo",
          "source": "GGUF_MMProj_Repo"
        },
        {
          "id": "GGUF_MMProj_File",
          "source": "GGUF_MMProj_File"
        },
        {
          "id": "Prompt_Type",
          "source": "Prompt_Type"
        },
        {
          "id": "Max_New_Tokens",
          "source": "Max_New_Tokens"
        },
        {
          "id": "GGUF_Ctx",
          "source": "GGUF_Ctx"
        },
        {
          "id": "Render_DPI",
          "source": "Render_DPI"
        }
      ],
      "out": [
        {
          "id": "ocr_results"
        },
        {
          "id": "run_log"
        }
      ],
      "run": {
        "class": "CommandLineTool",
        "cwlVersion": "v1.2",
        "baseCommand": [
          "bash",
          "run.sh"
        ],
        "inputs": [
          {
            "id": "PDF",
            "type": "File",
            "inputBinding": {
              "prefix": "--pdf",
              "shellQuote": true,
              "position": 0
            }
          },
          {
            "id": "HF_Model_ID",
            "type": "string?",
            "inputBinding": {
              "prefix": "--model-id",
              "shellQuote": true,
              "position": 0
            },
            "default": "datalab-to/chandra-ocr-2"
          },
          {
            "id": "Local_Model_Snapshot",
            "type": "Directory?",
            "inputBinding": {
              "prefix": "--local-model-dir",
              "shellQuote": true,
              "position": 0
            }
          },
          {
            "id": "Use_GGUF",
            "type": "boolean?",
            "inputBinding": {
              "prefix": "--use-gguf",
              "position": 0,
              "valueFrom": "$(self ? 'true' : 'false')"
            },
            "default": false
          },
          {
            "id": "GGUF_Model",
            "type": "File?",
            "inputBinding": {
              "prefix": "--gguf-model",
              "shellQuote": true,
              "position": 0
            }
          },
          {
            "id": "GGUF_Repo",
            "type": "string?",
            "inputBinding": {
              "prefix": "--gguf-repo",
              "shellQuote": true,
              "position": 0
            },
            "default": "prithivMLmods/chandra-ocr-2-GGUF"
          },
          {
            "id": "GGUF_File",
            "type": "string?",
            "inputBinding": {
              "prefix": "--gguf-file",
              "shellQuote": true,
              "position": 0
            },
            "default": "chandra-ocr-2.F32.gguf"
          },
          {
            "id": "GGUF_MMProj",
            "type": "File?",
            "inputBinding": {
              "prefix": "--gguf-mmproj",
              "shellQuote": true,
              "position": 0
            }
          },
          {
            "id": "GGUF_MMProj_Repo",
            "type": "string?",
            "inputBinding": {
              "prefix": "--gguf-mmproj-repo",
              "shellQuote": true,
              "position": 0
            },
            "default": "prithivMLmods/chandra-ocr-2-GGUF"
          },
          {
            "id": "GGUF_MMProj_File",
            "type": "string?",
            "inputBinding": {
              "prefix": "--gguf-mmproj-file",
              "shellQuote": true,
              "position": 0
            }
          },
          {
            "id": "Prompt_Type",
            "type": "string?",
            "inputBinding": {
              "prefix": "--prompt-type",
              "shellQuote": true,
              "position": 0
            },
            "default": "ocr_layout"
          },
          {
            "id": "Max_New_Tokens",
            "type": "int?",
            "inputBinding": {
              "prefix": "--max-new-tokens",
              "shellQuote": true,
              "position": 0
            },
            "default": 8192
          },
          {
            "id": "GGUF_Ctx",
            "type": "int?",
            "inputBinding": {
              "prefix": "--gguf-ctx",
              "shellQuote": true,
              "position": 0
            },
            "default": 32768
          },
          {
            "id": "Render_DPI",
            "type": "int?",
            "inputBinding": {
              "prefix": "--dpi",
              "shellQuote": true,
              "position": 0
            },
            "default": 220
          }
        ],
        "outputs": [
          {
            "id": "ocr_results",
            "type": "Directory",
            "outputBinding": {
              "glob": "ocr_results"
            }
          },
          {
            "id": "run_log",
            "type": "File",
            "outputBinding": {
              "glob": "run_log.json"
            }
          }
        ],
        "requirements": [
          {
            "class": "InitialWorkDirRequirement",
            "listing": [
              {
                "entryname": "run.sh",
                "entry": "#!/bin/bash\nset -euo pipefail\n\nPDF_PATH=\"\"\nMODEL_ID=\"datalab-to/chandra-ocr-2\"\nLOCAL_MODEL_DIR=\"\"\nMETHOD=\"hf\"\nUSE_GGUF=\"false\"\nGGUF_MODEL_PATH=\"\"\nGGUF_REPO=\"prithivMLmods/chandra-ocr-2-GGUF\"\nGGUF_FILE=\"chandra-ocr-2.F32.gguf\"\nGGUF_MMPROJ_PATH=\"\"\nGGUF_MMPROJ_REPO=\"prithivMLmods/chandra-ocr-2-GGUF\"\nGGUF_MMPROJ_FILE=\"\"\nPROMPT_TYPE=\"ocr_layout\"\nMAX_NEW_TOKENS=\"8192\"\nGGUF_CTX=\"32768\"\nDPI=\"220\"\n\nwhile [[ $# -gt 0 ]]; do\n  case \"$1\" in\n    --pdf)\n      PDF_PATH=\"$2\"\n      shift 2\n      ;;\n    --model-id)\n      MODEL_ID=\"$2\"\n      shift 2\n      ;;\n    --local-model-dir)\n      LOCAL_MODEL_DIR=\"$2\"\n      shift 2\n      ;;\n    --use-gguf)\n      USE_GGUF=\"$2\"\n      shift 2\n      ;;\n    --gguf-model)\n      GGUF_MODEL_PATH=\"$2\"\n      shift 2\n      ;;\n    --gguf-repo)\n      GGUF_REPO=\"$2\"\n      shift 2\n      ;;\n    --gguf-file)\n      GGUF_FILE=\"$2\"\n      shift 2\n      ;;\n    --gguf-mmproj)\n      GGUF_MMPROJ_PATH=\"$2\"\n      shift 2\n      ;;\n    --gguf-mmproj-repo)\n      GGUF_MMPROJ_REPO=\"$2\"\n      shift 2\n      ;;\n    --gguf-mmproj-file)\n      GGUF_MMPROJ_FILE=\"$2\"\n      shift 2\n      ;;\n    --prompt-type)\n      PROMPT_TYPE=\"$2\"\n      shift 2\n      ;;\n    --max-new-tokens)\n      MAX_NEW_TOKENS=\"$2\"\n      shift 2\n      ;;\n    --gguf-ctx)\n      GGUF_CTX=\"$2\"\n      shift 2\n      ;;\n    --dpi)\n      DPI=\"$2\"\n      shift 2\n      ;;\n    *)\n      echo \"Unknown argument: $1\" >&2\n      exit 1\n      ;;\n  esac\ndone\n\nif [[ -z \"$PDF_PATH\" || ! -s \"$PDF_PATH\" ]]; then\n  echo \"Input PDF is required and must be non-empty.\" >&2\n  exit 1\nfi\n\nif [[ -n \"$LOCAL_MODEL_DIR\" && ! -d \"$LOCAL_MODEL_DIR\" ]]; then\n  echo \"Local model directory does not exist: $LOCAL_MODEL_DIR\" >&2\n  exit 1\nfi\n\nif [[ -n \"$GGUF_MODEL_PATH\" && ! -s \"$GGUF_MODEL_PATH\" ]]; then\n  echo \"GGUF model file does not exist: $GGUF_MODEL_PATH\" >&2\n  exit 1\nfi\n\nif [[ -n \"$GGUF_MMPROJ_PATH\" && ! -s \"$GGUF_MMPROJ_PATH\" ]]; then\n  echo \"GGUF mmproj file does not exist: $GGUF_MMPROJ_PATH\" >&2\n  exit 1\nfi\n\nexport PIP_ROOT_USER_ACTION=ignore\npython3 -m pip install --no-cache-dir --upgrade pip >/dev/null\npython3 -m pip install --no-cache-dir \"chandra-ocr[hf]>=0.2.0\" >/dev/null\n\nif [[ \"$USE_GGUF\" == \"true\" || -n \"$GGUF_MODEL_PATH\" || -n \"$GGUF_MMPROJ_PATH\" ]]; then\n  echo \"Warning: GGUF arguments are ignored in simplified mode. Using official Chandra CLI with --method hf.\" >&2\nfi\n\nif [[ -n \"$LOCAL_MODEL_DIR\" ]]; then\n  export MODEL_CHECKPOINT=\"$LOCAL_MODEL_DIR\"\nelse\n  export MODEL_CHECKPOINT=\"$MODEL_ID\"\nfi\n\nmkdir -p ocr_results\nchandra \"$PDF_PATH\" ocr_results --method \"$METHOD\" --max-output-tokens \"$MAX_NEW_TOKENS\"\n\nPDF_BASENAME=\"`basename \"$PDF_PATH\"`\"\nPDF_STEM=\"`printf '%s\\n' \"$PDF_BASENAME\" | sed 's/\\.[^.]*$//'`\"\nDOC_DIR=\"ocr_results/$PDF_STEM\"\nMD_PATH=\"$DOC_DIR/$PDF_STEM.md\"\nHTML_PATH=\"$DOC_DIR/$PDF_STEM.html\"\nMETA_PATH=\"$DOC_DIR/$PDF_STEM\"_metadata.json\nORIGINAL_PDF_PATH=\"$DOC_DIR/original.pdf\"\nFAITHFUL_HTML_PATH=\"$DOC_DIR/pdf_faithful_view.html\"\n\nmkdir -p \"$DOC_DIR\"\ncp \"$PDF_PATH\" \"$ORIGINAL_PDF_PATH\"\n\ncat > \"$FAITHFUL_HTML_PATH\" <<'HTML'\n<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>Faithful PDF View</title>\n  <style>\n    html, body {\n      margin: 0;\n      padding: 0;\n      width: 100%;\n      height: 100%;\n      background: #111;\n    }\n    iframe {\n      border: 0;\n      width: 100%;\n      height: 100%;\n      display: block;\n    }\n  </style>\n</head>\n<body>\n  <iframe src=\"original.pdf\" title=\"Faithful PDF View\"></iframe>\n</body>\n</html>\nHTML\n\npython3 - \"$PDF_BASENAME\" \"$METHOD\" \"$MODEL_CHECKPOINT\" \"$MAX_NEW_TOKENS\" \"$LOCAL_MODEL_DIR\" \"$DOC_DIR\" \"$MD_PATH\" \"$HTML_PATH\" \"$META_PATH\" \"$USE_GGUF\" \"$ORIGINAL_PDF_PATH\" \"$FAITHFUL_HTML_PATH\" <<'PY'\nimport json\nimport os\nimport sys\n\npdf_name = sys.argv[1]\nmethod = sys.argv[2]\nmodel_checkpoint = sys.argv[3]\nmax_output_tokens = int(sys.argv[4])\nlocal_model_dir = sys.argv[5]\ndoc_dir = sys.argv[6]\nmd_path = sys.argv[7]\nhtml_path = sys.argv[8]\nmeta_path = sys.argv[9]\nuse_gguf = sys.argv[10].lower() == \"true\"\noriginal_pdf_path = sys.argv[11]\nfaithful_view_path = sys.argv[12]\n\noutputs = [\n  p\n  for p in (md_path, html_path, meta_path, original_pdf_path, faithful_view_path)\n  if os.path.exists(p)\n]\n\nrun_log = {\n    \"input_pdf\": pdf_name,\n    \"ocr_mode\": method,\n    \"model_checkpoint\": model_checkpoint,\n    \"local_model_dir_used\": bool(local_model_dir),\n    \"max_output_tokens\": max_output_tokens,\n    \"gguf_requested\": use_gguf,\n    \"output_dir\": doc_dir,\n    \"original_pdf_copy\": original_pdf_path,\n    \"faithful_view_html\": faithful_view_path,\n    \"outputs\": outputs,\n}\n\nwith open(\"run_log.json\", \"w\", encoding=\"utf-8\") as f:\n    json.dump(run_log, f, indent=2, ensure_ascii=False)\nPY\n"
              }
            ]
          }
        ],
        "hints": [
          {
            "class": "sbg:AWSInstanceType",
            "value": "r7i.12xlarge"
          },
          {
            "class": "DockerRequirement",
            "dockerPull": "python:3.11-slim"
          }
        ]
      }
    }
  ],
  "requirements": [
    {
      "class": "InlineJavascriptRequirement"
    },
    {
      "class": "StepInputExpressionRequirement"
    }
  ]
}
