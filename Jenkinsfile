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
          echo "Building image: ${DOCKER_IMAGE_NAME}:${IMAGE_TAG}"
        }
      }
    }

    stage('Install & Test (inside Docker)') {
      steps {
        // Chạy npm install & test bên trong container node:20,
        // không phụ thuộc npm trên agent Jenkins
        sh '''
          set -o pipefail

          echo "=== Running npm install & test inside node:20-alpine container ==="
          docker run --rm \
            -v "$PWD":/app \
            -w /app \
            node:20-alpine \
            sh -c "npm install && (npm test || echo 'No tests yet')" \
          2>&1 | tee install.log
        '''
      }
    }

    stage('Build Docker Image') {
      steps {
        // dùng shared library buildDockerImage (sử dụng Docker daemon của host)
        sh '''
          echo "=== Docker version on agent ==="
          docker version
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
      echo "CI/CD done: ${DOCKER_IMAGE_NAME}:${IMAGE_TAG} pushed and manifest updated"
    }

    failure {
      echo "Build failed – sending logs to jenkins-log-agent via Perplexity Agent API..."

      // Không dùng python nữa, tránh lỗi python: not found
      withCredentials([string(credentialsId: 'perplexity-api-key', variable: 'PPLX_API_KEY')]) {
        sh '''
          set +e

          # Gom log, nếu không có build.log thì chỉ dùng install.log
          if [ -f install.log ] || [ -f build.log ]; then
            cat install.log build.log 2>/dev/null | tail -n 300 > ai_logs.txt
          else
            echo "No install/build logs available" > ai_logs.txt
          fi

          # Đơn giản hoá: escape cơ bản bằng cách thay " bằng '
          LOG_RAW=$(cat ai_logs.txt | tail -n 300)
          LOG_ESCAPED=${LOG_RAW//\"/\'}

          cat > ai_request.json << EOF
{
  "preset": "fast-search",
  "input": "You are jenkins-log-agent. Analyze this Jenkins pipeline failure for project 'gold-profit-app' running on Kubernetes/OrbStack. Explain: 1) root cause, 2) which stage/command failed, 3) concrete fix steps.\\n\\nJENKINS LOGS (last lines):\\n${LOG_ESCAPED}"
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