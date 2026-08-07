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
        script {
          echo "Preparing build for: ${DOCKER_IMAGE_NAME}:${IMAGE_TAG}"
        }
      }
    }

    /**
     * Dummy build stage: hiện tại chỉ mô phỏng lỗi môi trường
     * (thiếu npm, docker) để test AI phân tích log.
     * Sau này có thể thay bằng npm build + docker build thực tế.
     */
    stage('Dummy Build') {
      steps {
        sh '''
          set -e

          echo "=== Dummy build step for gold-profit-app ==="
          echo "[Env] Jenkins + Kubernetes (OrbStack) agent."
          echo "[Info] This step simulates typical CI/CD failures."
          echo

          echo "[Build] Running npm install..."
          echo "ERROR: npm not found on this agent."
          echo

          echo "[Build] Running docker build..."
          echo "ERROR: Docker daemon is not running."
          echo

          echo "[Result] Simulating build failure for AI analysis."
          exit 1
        '''
      }
    }

    // ================== AI STAGES (chỉ chạy khi FAIL) ==================

    stage('Prepare AI Log') {
      when {
        expression { currentBuild.currentResult == 'FAILURE' }
      }
      steps {
        script {
          // Tạm thời dùng log mẫu; sau này có thể thay bằng log thực
          writeFile(
            file: 'jenkins.log',
            text: '''
[Checkout] SUCCESS

[Build]
Running npm install...
ERROR: npm not found on this agent.

Running docker build...
ERROR: Docker daemon is not running.

Build failed with exit code 1.
'''
          )
          echo "[AI] Prepared jenkins.log for analysis."
        }
      }
    }

    stage('Create AI Request') {
      when {
        expression { currentBuild.currentResult == 'FAILURE' }
      }
      steps {
        script {
          def log = readFile('jenkins.log')

          def prompt = """
You are an expert DevOps AI specializing in Jenkins, Docker, Kubernetes, Helm and ArgoCD.

This is a Jenkins pipeline for project 'gold-profit-app' running on Jenkins + Kubernetes (OrbStack).

Analyze the Jenkins build log.

Return ONLY ONE valid JSON object.

Do NOT use markdown.

Schema:

{
  "status":"",
  "stage":"",
  "root_cause":"",
  "summary":"",
  "confidence":0,
  "suggested_actions":[],
  "affected_component":"",
  "severity":"LOW|MEDIUM|HIGH|CRITICAL"
}

Build Log:

${log}
"""

          writeJSON(
            file: "ai-request.json",
            pretty: 4,
            json: [
              preset: "fast-search",
              input : prompt
            ]
          )

          echo "[AI] Created ai-request.json for Perplexity."
        }
      }
    }

    stage('Call Perplexity') {
      when {
        expression { currentBuild.currentResult == 'FAILURE' }
      }
      steps {
        withCredentials([
          string(
            credentialsId: 'perplexity-api-key',
            variable: 'PPLX_API_KEY'
          )
        ]) {
          sh '''
            set -e

            echo "[AI] Calling Perplexity for gold-profit-app..."

            curl -sS https://api.perplexity.ai/v1/responses \
              -H "Authorization: Bearer ${PPLX_API_KEY}" \
              -H "Content-Type: application/json" \
              --data-binary @ai-request.json \
              -o ai-response.json

            echo "[AI] Raw response from Perplexity:"
            echo "===================================="
            cat ai-response.json
            echo "===================================="
          '''
        }
      }
    }

    stage('Parse AI Response') {
      when {
        expression { currentBuild.currentResult == 'FAILURE' }
      }
      steps {
        script {
          def resp = readJSON file: "ai-response.json"

          def message = resp.output.find { it.type == "message" }
          if (!message) {
            error "[AI] Cannot find message object in AI response."
          }

          def textBlock = message.content.find { it.type == "output_text" }
          if (!textBlock) {
            error "[AI] Cannot find output_text in AI response."
          }

          echo "[AI] Received JSON text from Perplexity:"
          echo "===================================="
          echo textBlock.text
          echo "===================================="

          def ai = readJSON text: textBlock.text

          writeJSON(
            file: "ai-summary.json",
            pretty: 4,
            json: ai
          )

          // Build description gọn, rõ severity + summary + confidence
          currentBuild.description = """
❌ ${ai.severity ?: 'UNKNOWN'}

${ai.summary ?: 'No summary provided.'}

Confidence: ${ai.confidence ?: 0}
"""

          def actions = ai.suggested_actions instanceof List ? ai.suggested_actions : []

          def html = """
<html>
<head>
  <title>AI Analysis - gold-profit-app</title>
  <style>
    body{
      font-family:Arial, sans-serif;
      margin:30px;
    }
    table{
      width:100%;
      border-collapse:collapse;
    }
    td,th{
      border:1px solid #ddd;
      padding:8px;
    }
    th{
      background:#efefef;
      text-align:left;
    }
    h2, h3{
      margin-top:24px;
    }
  </style>
</head>
<body>

  <h2>AI Analysis for gold-profit-app</h2>

  <table>
    <tr><th>Status</th><td>${ai.status}</td></tr>
    <tr><th>Stage</th><td>${ai.stage}</td></tr>
    <tr><th>Severity</th><td>${ai.severity}</td></tr>
    <tr><th>Root Cause</th><td>${ai.root_cause}</td></tr>
    <tr><th>Summary</th><td>${ai.summary}</td></tr>
    <tr><th>Confidence</th><td>${ai.confidence}</td></tr>
    <tr><th>Affected Component</th><td>${ai.affected_component}</td></tr>
  </table>

  <h3>Suggested Actions</h3>
  <ul>
    ${actions.collect { "<li>${it}</li>" }.join("\\n")}
  </ul>

</body>
</html>
"""

          writeFile(
            file: "ai-summary.html",
            text: html
          )

          echo "[AI] Wrote ai-summary.json and ai-summary.html."
        }
      }
    }

    stage('Publish AI Report') {
      when {
        expression { currentBuild.currentResult == 'FAILURE' }
      }
      steps {
        publishHTML(target: [
          reportDir: '.',
          reportFiles: 'ai-summary.html',
          reportName: 'AI Analysis - gold-profit-app',
          keepAll: true,
          alwaysLinkToLastBuild: true
        ])

        echo "[AI] Published AI Analysis HTML report."
      }
    }
  }

  post {
    success {
      echo "✅ Pipeline finished successfully for gold-profit-app."
    }

    failure {
      echo "❌ Pipeline failed for gold-profit-app – AI analysis generated (check report & description)."
    }

    always {
      archiveArtifacts artifacts: '''
jenkins.log,
ai-request.json,
ai-response.json,
ai-summary.json,
ai-summary.html
'''
    }
  }
}