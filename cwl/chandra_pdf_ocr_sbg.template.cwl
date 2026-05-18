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
                "entry": "__RUN_SH__"
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
