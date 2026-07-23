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

          # Lấy 300 dòng cuối của log job từ workspace (demo đơn giản)
          {
            echo "=== Jenkins workspace listing ==="
            ls -R .
          } > ai_logs.txt

          # Escape dấu " để không vỡ JSON
          LOG_ESCAPED=$(sed 's/"/\\"/g' ai_logs.txt | tail -n 300)

          cat > ai_request.json << EOF
{
  "preset": "fast-search",
  "input": "You are jenkins-log-agent. Analyze this Jenkins pipeline failure for project 'gold-profit-app' on Jenkins+k8s OrbStack. Explain: 1) root cause, 2) which stage/command failed, 3) concrete fix steps.\\n\\nJENKINS LOGS (last lines):\\n${LOG_ESCAPED}"
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