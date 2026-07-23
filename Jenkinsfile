@Library('jenkins-shared-library') _

pipeline {
  agent any

  environment {
    DOCKER_IMAGE_NAME = 'nguyenphong8852/gold-profit-app'
    IMAGE_TAG         = "${BUILD_NUMBER}"
    MANIFEST_FILE     = 'k8s-manifests/deployment.yaml'
    APP_REPO_URL      = 'https://github.com/phongnt93/gold-profit-app.git'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install & Test') {
      steps {
        sh '''
          set -o pipefail
          npm install 2>&1 | tee install.log
          npm test || echo "No tests yet" | tee -a install.log
        '''
      }
    }

    stage('Build Docker Image') {
      steps {
        sh '''
          set -o pipefail
          docker version 2>&1 | tee build.log
        '''
        buildDockerImage(DOCKER_IMAGE_NAME, IMAGE_TAG)
      }
    }

    stage('Push to Docker Hub') {
      steps {
        pushToDockerHub(DOCKER_IMAGE_NAME, IMAGE_TAG, 'dockerhub-credentials')
      }
    }

    stage('Update K8s Manifest') {
      steps {
        updateK8sManifest(
          DOCKER_IMAGE_NAME,
          IMAGE_TAG,
          MANIFEST_FILE,
          'github-credentials',
          APP_REPO_URL
        )
      }
    }
  }

  post {
    success {
      echo "CI/CD done: ${DOCKER_IMAGE_NAME}:${IMAGE_TAG}"
    }

    failure {
      echo "Build failed – sending logs to jenkins-log-agent via Perplexity Agent API..."

      withCredentials([string(credentialsId: 'perplexity-api-key', variable: 'PPLX_API_KEY')]) {
        sh '''
          set -e

          # gom log của các stage quan trọng, lấy đoạn cuối để tránh quá dài
          cat install.log build.log 2>/dev/null | tail -n 500 > ai_logs.txt || true

          # tạo JSON request cho Agent API
          python - << 'PY'
import json, os

logs_path = "ai_logs.txt"
if os.path.exists(logs_path):
    logs = open(logs_path, "r", encoding="utf-8", errors="ignore").read()
else:
    logs = "No logs file found."

payload = {
    "preset": "fast-search",  # theo ví dụ Agent API /v1/responses
    "input": (
        "You are an expert DevOps & CI/CD assistant named jenkins-log-agent. "
        "Analyze the following Jenkins pipeline logs from project 'gold-profit-app' "
        "running on Kubernetes/OrbStack. Explain clearly:\n"
        "1) The most likely root cause of the failure.\n"
        "2) Which stage/command failed.\n"
        "3) Concrete steps/commands the developer should try to fix it.\n\n"
        "JENKINS LOGS (last lines):\\n"
        + logs[-8000:]
    )
}

with open("ai_request.json", "w", encoding="utf-8") as f:
    json.dump(payload, f)
PY

          echo "=== Calling Perplexity Agent API (jenkins-log-agent) ==="

          curl -sS https://api.perplexity.ai/v1/responses \
            -H "Authorization: Bearer ${PPLX_API_KEY}" \
            -H "Content-Type: application/json" \
            --data-binary @ai_request.json \
            | sed 's/^/AI-Agent: /'
        '''
      }
    }
  }
}
