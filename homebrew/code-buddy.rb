# Homebrew formula for Code Buddy CLI
# Install: brew tap phuetz/code-buddy && brew install code-buddy

class CodeBuddy < Formula
  desc "AI-powered terminal agent using Grok API for code assistance"
  homepage "https://github.com/phuetz/code-buddy"
  url "https://registry.npmjs.org/@phuetz/code-buddy/-/code-buddy-1.0.0.tgz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"

  depends_on "node@20"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  def caveats
    <<~EOS
      Code Buddy requires a Grok API key to function.
      Set your API key:
        export GROK_API_KEY=your_api_key_here

      Or create a config file at ~/.codebuddy/config.json:
        {
          "apiKey": "your_api_key_here"
        }

      Get your API key from: https://x.ai/
    EOS
  end

  test do
    assert_match "Code Buddy", shell_output("#{bin}/codebuddy --version")
  end
end
