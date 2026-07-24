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