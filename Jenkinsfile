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

    // Tạm thời KHÔNG chạy npm hay docker ở đây để tránh lỗi môi trường agent
    // Dummy step để test AI agent khi pipeline FAIL
    stage('Dummy Build Step') {
      steps {
        sh '''
          echo "=== Dummy build step ==="
          echo "Agent image does not have docker/node yet, so this step only simulates build."
          # Force an error to test AI agent integration
          exit 1
        '''
      }
    }
  }

  post {
    success {
      echo "Pipeline finished successfully (dummy build)."
    }

    failure {
      echo "Build failed – sending logs to jenkins-log-agent via Perplexity Agent API..."

      withCredentials([string(credentialsId: 'perplexity-api-key', variable: 'PPLX_API_KEY')]) {
        sh '''
          set +e

          # Gom thông tin workspace làm "log" demo
          {
            echo "=== Jenkins workspace listing ==="
            ls -R .
          } > ai_logs.txt

          # Mã hoá log thành base64 để tránh lỗi JSON với \\n, \", ...
          LOG_B64=$(base64 -w0 ai_logs.txt 2>/dev/null || base64 ai_logs.txt)

          cat > ai_request.json << EOF
{
  "preset": "fast-search",
  "input": "You are jenkins-log-agent. The Jenkins pipeline for project 'gold-profit-app' on Jenkins+k8s OrbStack has FAILED. I will provide the logs encoded as base64.\\n\\n1) Decode the base64 string back to text.\\n2) Analyze the failure: root cause, which stage/command failed, and concrete fix steps.\\n\\nBASE64-ENCODED LOGS:\\n${LOG_B64}"
}
EOF

          echo "=== Calling Perplexity Agent API (jenkins-log-agent) ==="

          curl -sS https://api.perplexity.ai/v1/responses \
            -H "Authorization: Bearer ${PPLX_API_KEY}" \
            -H "Content-Type: application/json" \
            --data-binary @ai_request.json \
            | sed 's/^/AI-Agent: /' || echo "AI-Agent call failed (curl error)"
        '''
      }
    }
  }
}