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

    // Stage build giả lập – cố tình FAIL để test AI
    stage('Dummy Build Step') {
      steps {
        sh '''
          echo "=== Dummy build step for gold-profit-app ==="
          echo "Agent image does not have docker/node yet, so this step only simulates build."
          echo "Trying to run npm and docker to simulate typical CI/CD failure..."

          echo "[Build] Running npm install..."
          echo "ERROR: npm not found on this agent."

          echo "[Build] Running docker build..."
          echo "ERROR: Docker daemon is not running."

          # Force an error to test AI analysis
          exit 1
        '''
      }
    }

    // ====== AI STAGES (áp dụng từ Jenkinsfile test) ======

    stage('Prepare AI Log') {
      when {
        expression { currentBuild.currentResult == 'FAILURE' }
      }
      steps {
        script {
          // Lấy console log của build hiện tại lưu vào jenkins.log (đơn giản hóa)
          // Nếu cần log đầy đủ, có thể dùng manager.build.logFile hoặc API khác
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

echo "=== Calling Perplexity AI for gold-profit-app ==="

curl -sS https://api.perplexity.ai/v1/responses \
  -H "Authorization: Bearer ${PPLX_API_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary @ai-request.json \
  -o ai-response.json

echo "========== RAW AI RESPONSE =========="
cat ai-response.json
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

          /*
           * Perplexity Response:
           *
           * output:
           *   - search_results
           *   - message
           */

          def message = resp.output.find { it.type == "message" }

          if (message == null) {
            error("Cannot find message object in AI response.")
          }

          def textBlock = message.content.find {
            it.type == "output_text"
          }

          if (textBlock == null) {
            error("Cannot find output_text in AI response.")
          }

          echo "=========== AI JSON (raw text) ==========="
          echo textBlock.text

          def ai = readJSON text: textBlock.text

          writeJSON(
            file: "ai-summary.json",
            pretty: 4,
            json: ai
          )

          // Cập nhật description cho build của gold-profit-app
          currentBuild.description = """
❌ ${ai.severity}

${ai.summary}

Confidence: ${ai.confidence}
"""

          // Sinh HTML report cho gold-profit-app
          def actions = ai.suggested_actions instanceof List ? ai.suggested_actions : []

          def html = """
<html>

<head>

<title>AI Analysis - gold-profit-app</title>

<style>

body{
font-family:Arial;
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
}

</style>

</head>

<body>

<h2>AI Analysis for gold-profit-app</h2>

<table>

<tr>
<th>Status</th>
<td>${ai.status}</td>
</tr>

<tr>
<th>Stage</th>
<td>${ai.stage}</td>
</tr>

<tr>
<th>Severity</th>
<td>${ai.severity}</td>
</tr>

<tr>
<th>Root Cause</th>
<td>${ai.root_cause}</td>
</tr>

<tr>
<th>Summary</th>
<td>${ai.summary}</td>
</tr>

<tr>
<th>Confidence</th>
<td>${ai.confidence}</td>
</tr>

<tr>
<th>Affected Component</th>
<td>${ai.affected_component}</td>
</tr>

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
        }
      }
    }

    stage('Publish HTML') {
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
      }
    }
  }

  post {
    success {
      echo "Pipeline finished successfully for gold-profit-app."
    }

    failure {
      echo "Build failed for gold-profit-app – AI analysis generated."
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