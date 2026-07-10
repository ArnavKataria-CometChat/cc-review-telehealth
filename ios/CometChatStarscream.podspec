Pod::Spec.new do |s|
  s.name             = 'CometChatStarscream'
  s.version          = '1.0.2'
  s.summary          = 'CometChat fork of Starscream (WebSocket) — a CometChatSDK runtime dependency.'
  s.description      = <<-DESC
    Local podspec that vendors the standalone CometChatStarscream xcframework.

    CometChatSDK 4.1.x's binary hard-imports the `CometChatStarscream` module,
    and its podspec lists CometChatStarscream.xcframework under
    `vendored_frameworks` — but the published CometChatSDK pod artifact does NOT
    actually bundle it (upstream packaging gap), so the app fails to compile with
    "unable to resolve module dependency: 'CometChatStarscream'". This podspec
    supplies the framework from CometChat's public framework CDN (the same
    artifact the SwiftPM chat-sdk-ios package downloads) so `pod install` yields
    a buildable target.
  DESC
  s.homepage         = 'https://www.cometchat.com'
  s.license          = { :type => 'Commercial', :text => 'CometChat' }
  s.author           = 'CometChat'
  s.platform         = :ios, '13.0'
  s.source           = { :http => 'https://library.cometchat.io/ios/v4.0/xcode15/CometChatStarscream_1_0_2.xcframework.zip' }
  s.vendored_frameworks = 'CometChatStarscream.xcframework'
end
