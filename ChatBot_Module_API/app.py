"""
Main entry point for Universal Chatbot Python NLP Microservice.
Runs the clean NLP microservice in python/main.py.
"""
import os
import sys
import subprocess

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHON_DIR = os.path.join(ROOT_DIR, "python")
VENV_PYTHON = os.path.join(ROOT_DIR, ".venv", "Scripts", "python.exe")

if __name__ == "__main__":
    py_exe = VENV_PYTHON if os.path.isfile(VENV_PYTHON) else sys.executable
    cmd = [py_exe, os.path.join(PYTHON_DIR, "main.py")] + sys.argv[1:]
    sys.exit(subprocess.call(cmd, cwd=PYTHON_DIR))
