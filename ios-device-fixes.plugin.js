const { withDangerousMod, withEntitlementsPlist, withInfoPlist, withXcodeProject } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const GOOGLE_OAUTH_REDIRECT_SCHEME = 'com.eazee.ai';
const SIMdJSON_SNIPPET = `  simdjson_package_path = \`node --print "(() => { try { return require.resolve('@nozbe/simdjson/package.json') } catch { const watermelondb = require.resolve('@nozbe/watermelondb/package.json'); return require('path').join(require('path').dirname(watermelondb), 'node_modules', '@nozbe', 'simdjson', 'package.json'); } })()"\`.strip
  pod 'simdjson', path: File.dirname(simdjson_package_path), :modular_headers => true`;

const INHIBIT_WARNINGS_SNIPPET = 'inhibit_all_warnings!';
const FMT_MARKER = '# Fix fmt 11 consteval compilation error on Xcode 26.4+';
const FMT_SNIPPET = `    ${FMT_MARKER}
    fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      patched = content.gsub(/^#\\s*define FMT_USE_CONSTEVAL 1$/, '# define FMT_USE_CONSTEVAL 0')
      if patched != content
        File.chmod(0644, fmt_base)
        File.write(fmt_base, patched)
      end
    end`;

const POD_WARNINGS_MARKER = '# Silence Pod deployment-target and script-phase warnings';
const POD_WARNINGS_SNIPPET = `    # Silence Pod deployment-target and script-phase warnings
    installer.pods_project.targets.each do |pod_target|
      pod_target.build_configurations.each do |pod_config|
        pod_config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
        deployment_target = pod_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if deployment_target && Gem::Version.new(deployment_target) < Gem::Version.new('15.1')
          pod_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
      pod_target.build_phases.each do |build_phase|
        build_phase.always_out_of_date = '1' if build_phase.respond_to?(:always_out_of_date)
      end
    end

    installer.aggregate_targets.each do |aggregate_target|
      aggregate_target.user_project.native_targets.each do |user_target|
        user_target.build_phases.each do |build_phase|
          build_phase.always_out_of_date = '1' if build_phase.respond_to?(:always_out_of_date)
        end
      end
      aggregate_target.user_project.save
    end`;

const PRIVACY_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>NSPrivacyAccessedAPITypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>C617.1</string>
\t\t\t\t<string>0A2A.1</string>
\t\t\t\t<string>3B52.1</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>CA92.1</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryDiskSpace</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>E174.1</string>
\t\t\t\t<string>85F4.1</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategorySystemBootTime</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>35F9.1</string>
\t\t\t</array>
\t\t</dict>
\t</array>
\t<key>NSPrivacyCollectedDataTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>NSPrivacyCollectedDataType</key>
\t\t\t<string>NSPrivacyCollectedDataTypeName</string>
\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key>
\t\t\t<true/>
\t\t\t<key>NSPrivacyCollectedDataTypeTracking</key>
\t\t\t<false/>
\t\t\t<key>NSPrivacyCollectedDataTypePurposes</key>
\t\t\t<array>
\t\t\t\t<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyCollectedDataType</key>
\t\t\t<string>NSPrivacyCollectedDataTypeEmailAddress</string>
\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key>
\t\t\t<true/>
\t\t\t<key>NSPrivacyCollectedDataTypeTracking</key>
\t\t\t<false/>
\t\t\t<key>NSPrivacyCollectedDataTypePurposes</key>
\t\t\t<array>
\t\t\t\t<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyCollectedDataType</key>
\t\t\t<string>NSPrivacyCollectedDataTypeUserID</string>
\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key>
\t\t\t<true/>
\t\t\t<key>NSPrivacyCollectedDataTypeTracking</key>
\t\t\t<false/>
\t\t\t<key>NSPrivacyCollectedDataTypePurposes</key>
\t\t\t<array>
\t\t\t\t<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyCollectedDataType</key>
\t\t\t<string>NSPrivacyCollectedDataTypeAudioData</string>
\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key>
\t\t\t<true/>
\t\t\t<key>NSPrivacyCollectedDataTypeTracking</key>
\t\t\t<false/>
\t\t\t<key>NSPrivacyCollectedDataTypePurposes</key>
\t\t\t<array>
\t\t\t\t<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyCollectedDataType</key>
\t\t\t<string>NSPrivacyCollectedDataTypeOtherUserContent</string>
\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key>
\t\t\t<true/>
\t\t\t<key>NSPrivacyCollectedDataTypeTracking</key>
\t\t\t<false/>
\t\t\t<key>NSPrivacyCollectedDataTypePurposes</key>
\t\t\t<array>
\t\t\t\t<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyCollectedDataType</key>
\t\t\t<string>NSPrivacyCollectedDataTypeOtherDiagnosticData</string>
\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key>
\t\t\t<true/>
\t\t\t<key>NSPrivacyCollectedDataTypeTracking</key>
\t\t\t<false/>
\t\t\t<key>NSPrivacyCollectedDataTypePurposes</key>
\t\t\t<array>
\t\t\t\t<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
\t\t\t</array>
\t\t</dict>
\t</array>
\t<key>NSPrivacyTracking</key>
\t<false/>
</dict>
</plist>
`;

module.exports = function withIosDeviceFixes(config) {
  config = withInfoPlist(config, (config) => {
    const urlTypes = config.modResults.CFBundleURLTypes || [];
    const existingType = urlTypes.find((urlType) => (
      Array.isArray(urlType.CFBundleURLSchemes) &&
      urlType.CFBundleURLSchemes.includes(GOOGLE_OAUTH_REDIRECT_SCHEME)
    ));

    if (!existingType) {
      urlTypes.push({
        CFBundleURLSchemes: [GOOGLE_OAUTH_REDIRECT_SCHEME],
      });
      config.modResults.CFBundleURLTypes = urlTypes;
    }

    return config;
  });

  config = withXcodeProject(config, (config) => {
    const buildConfigurations = config.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(buildConfigurations)) {
      const buildSettings = buildConfigurations[key]?.buildSettings;
      if (buildSettings?.PRODUCT_BUNDLE_IDENTIFIER) {
        buildSettings.SENTRY_ALLOW_FAILURE = 'true';
      }
    }
    return config;
  });

  config = withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });

  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const privacyManifestPath = path.join(
        config.modRequest.platformProjectRoot,
        config.modRequest.projectName,
        'PrivacyInfo.xcprivacy'
      );
      if (fs.existsSync(path.dirname(privacyManifestPath))) {
        fs.writeFileSync(privacyManifestPath, PRIVACY_MANIFEST);
      }

      const schemePath = path.join(
        config.modRequest.platformProjectRoot,
        `${config.modRequest.projectName}.xcodeproj`,
        'xcshareddata',
        'xcschemes',
        `${config.modRequest.projectName}.xcscheme`
      );
      if (fs.existsSync(schemePath)) {
        const scheme = fs.readFileSync(schemePath, 'utf8');
        fs.writeFileSync(
          schemePath,
          scheme.replace(
            /(<LaunchAction\s+buildConfiguration = ")Debug(")/,
            '$1Release$2'
          )
        );
      }

      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let podfile = fs.readFileSync(podfilePath, 'utf8');

      podfile = podfile.replace(
        /  pod 'simdjson',[^\n]+\n/,
        `${SIMdJSON_SNIPPET}\n`
      );

      if (!podfile.includes(INHIBIT_WARNINGS_SNIPPET)) {
        podfile = podfile.replace(
          /(target 'Eazee' do\n)/,
          `$1  ${INHIBIT_WARNINGS_SNIPPET}\n`
        );
      }

      if (!podfile.includes(POD_WARNINGS_MARKER)) {
        podfile = podfile.replace(
          /(\s+react_native_post_install\([\s\S]*?\)\n)/,
          `$1\n${POD_WARNINGS_SNIPPET}\n`
        );
      }

      if (!podfile.includes(FMT_MARKER)) {
        podfile = podfile.replace(
          /(\s+react_native_post_install\([\s\S]*?\)\n)/,
          `$1\n${FMT_SNIPPET}\n`
        );
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
