import sys
import json
import os
import yaml
import io

# Force UTF-8 for Windows console
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Add tool sub video to path
# Cấu trúc: e:/portfolio/server/src/utils/sub_tool_runner.py
# Tool: e:/portfolio/tool sub video/
current_dir = os.path.dirname(os.path.abspath(__file__))
# Đi lên 3 cấp để ra portfolio, rồi vào 'tool sub video'
tool_dir = os.path.abspath(os.path.join(current_dir, '..', '..', '..', 'tool sub video'))
sys.path.insert(0, tool_dir)

try:
    from modules.srt_parser import parse_srt, save_srt
    from modules.translator import translate_subs
    from modules.tts import generate_audio_files
    from modules.audio_sync import sync_audio
    from modules.video_render import render_video, render_audio_only
except ImportError as e:
    print(json.dumps({"error": f"Import error: {str(e)}. Tool dir: {tool_dir}"}))
    sys.exit(1)

def main():
    try:
        # Read from stdin
        line = sys.stdin.read()
        if not line:
            return
            
        input_data = json.loads(line)
        cmd = input_data.get('command')
        config = input_data.get('config', {})
        
        # Create temp config.yaml in the temporary work directory if provided
        work_dir = input_data.get('work_dir', os.getcwd())
        config_path = os.path.join(work_dir, 'tmp_config.yaml')
        
        with open(config_path, 'w', encoding='utf-8') as f:
            yaml.dump(config, f)

        if cmd == 'translate':
            srt_path = input_data.get('srt_path')
            if not os.path.exists(srt_path):
                raise FileNotFoundError(f"SRT file not found: {srt_path}")
            
            subs = parse_srt(srt_path)
            translated = translate_subs(subs, config_path=config_path)
            # Return translated subtitles as JSON
            print(json.dumps(translated, ensure_ascii=False))
            
        elif cmd == 'tts_and_render':
            subs = input_data.get('subs')
            video_path = input_data.get('video_path') # Optional
            output_path = input_data.get('output_path')
            
            # Ensure output dir exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Handle subs if it's a string (raw SRT)
            if isinstance(subs, str):
                # If it looks like JSON array, parse it. Otherwise, it's raw SRT text.
                if subs.strip().startswith('['):
                    subs = json.loads(subs)
                else:
                    # Save raw SRT string to temp file and parse it
                    temp_srt = os.path.join(os.path.dirname(output_path), 'input_raw.srt')
                    with open(temp_srt, 'w', encoding='utf-8') as f:
                        f.write(subs)
                    subs = parse_srt(temp_srt)

            # Ensure all sub objects have start_ms and proper structure
            if isinstance(subs, list) and len(subs) > 0 and 'start_ms' not in subs[0]:
                srt_content = ""
                for s in subs:
                    idx = s.get('index', 1)
                    start = s.get('start', '00:00:00,000').replace('.', ',')
                    end = s.get('end', '00:00:00,000').replace('.', ',')
                    text = s.get('content', s.get('text', ''))
                    srt_content += f"{idx}\n{start} --> {end}\n{text}\n\n"
                
                temp_srt = os.path.join(os.path.dirname(output_path), 'input_raw.srt')
                with open(temp_srt, 'w', encoding='utf-8') as f:
                    f.write(srt_content)
                subs = parse_srt(temp_srt)

            # 1. Save temp SRT (needed by some modules)
            srt_out = os.path.join(os.path.dirname(output_path), 'temp_translated.srt')
            save_srt(subs, srt_out)
            
            # 2. TTS (Tạo audio từng câu)
            audio_dir = os.path.join(os.path.dirname(output_path), 'audio_chunks')
            os.makedirs(audio_dir, exist_ok=True)
            audio_files = generate_audio_files(subs, output_dir=audio_dir, config_path=config_path)
            
            # 3. Sync (Ghép thành 1 file audio dài)
            voice_full = os.path.join(os.path.dirname(output_path), 'voice_full.mp3')
            sync_audio(subs, audio_files, voice_full, config_path=config_path)
            
            # 4. Render Video
            if video_path and os.path.exists(video_path):
                render_video(video_path, voice_full, output_path, config_path=config_path)
            else:
                # Nếu không có video, tạo video nền đen
                render_audio_only(voice_full, output_path)
            
            print(json.dumps({"success": True, "output": output_path, "voice_full": voice_full}))

        else:
            print(json.dumps({"error": f"Unknown command: {cmd}"}))

    except Exception as e:
        import traceback
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)

if __name__ == "__main__":
    main()
