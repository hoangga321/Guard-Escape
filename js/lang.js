// Simple i18n manager for Guard Escape

var I18N = {
  current: "ko",

  strings: {
    // ================= VIETNAMESE =================
    vi: {
      title: "Guard Escape",
      hud_alert: "Mức cảnh giác",
      hud_status_playing: "Đang xâm nhập",
      hud_status_fail: "Bị phát hiện!",
      hud_status_clear: "Hoàn thành nhiệm vụ",
      hud_lang_label: "Ngôn ngữ",
      hud_decoy: "Mồi nhử",
      pause_title: "Tạm dừng",
      pause_resume: "Tiếp tục",
      pause_retry: "Chơi lại",
      pause_menu: "Về màn chính",

      // Stage 1 story / intro
      stage1_story:
        "Tầng ngầm của một phòng thí nghiệm bí mật. Bạn vừa vượt qua cửa bảo vệ đầu tiên. " +
        "Hãy len lỏi qua lính gác và tìm lối ra mà không để ai phát hiện.",

      // Tutorial lines
      tutorial_move:
        "Di chuyển bằng phím W A S D hoặc phím mũi tên. Giữ Shift để chạy nhanh hơn.",
      tutorial_goal:
        "Mục tiêu: tránh vùng nhìn hình nón của lính gác và chạm vào cửa EXIT ở bên phải để hoàn thành màn.",
      tutorial_actions:
        "Hành động: Nhấn F để ném decoy gây tiếng động, dụ lính gác quay sang hướng khác. " +
        "Khi bị phát hiện, mức cảnh giác tăng và lính sẽ truy đuổi.",
      tutorial_hint: "Nhấn phím Space hoặc Enter để tiếp tục…",
      tutorial_inspect:
        "Khi đến gần các thiết bị, máy móc hoặc bồn thí nghiệm, hãy nhấn phím E để kiểm tra. " +
        "Một số nơi sẽ chứa manh mối quan trọng về dữ liệu và các thí nghiệm bí mật.",
      stage2_story:
        "Bạn đã thoát khỏi tầng thí nghiệm. Phía trước là Tầng An Ninh chính – nơi điều phối toàn bộ camera và cổng khóa. Hãy lặng lẽ vượt qua hệ thống giám sát và trốn thoát khỏi trung tâm.",
      stage2_goal:
        "Mục tiêu: Cấu hình lại bảng điều khiển an ninh, tắt lớp laser bảo vệ và thoát ra cửa EXIT.",
      stage3_story:
        "Bạn đã tiến vào khu lõi của cơ sở. Tầng này là một 'lò sát sinh' với đầy bẫy tự động và hệ thống phòng thủ thử nghiệm – chỉ cần bước sai một ô là cả lưới laser bật sáng.",
      stage3_goal:
        "Mục tiêu: Dùng các máy console và công tắc trên sàn để vô hiệu đủ lưới laser và turret, sau đó tiến tới cổng EXIT ở mép phải bản đồ.",
      stage3_traps:
        "Cảnh báo: Khu này kết hợp turret bắn đạn, bẫy gai laser dưới sàn và cổng laser dựng đứng. Hãy để ý hình nón tầm nhìn của địch và các đường đỏ xuất phát từ console để hiểu máy nào điều khiển bẫy nào.",
      stage2_objective_hint:
        "Giữ [E] để hack bảng điều khiển chính và áp dụng cấu hình an ninh.",
      stage2_objective_done:
        "Cấu hình an ninh đã được áp dụng. Lối thoát có thể đã thay đổi.",
      stage2_objective_need_data:
        "Bạn cần hack bảng điều khiển trước khi có thể thoát khỏi tầng này.",
      stage2_laser_hint:
        "Có vẻ bảng điều khiển bên cạnh lối ra đang điều khiển lớp laser bảo vệ.",
      stage2_laser_off:
        "Lớp laser đã bị vô hiệu hóa. Cẩn thận, hệ thống an ninh vẫn còn đang hoạt động.",
      stage3_laser_hint:
        "Bảng điều khiển sàn này sẽ vô hiệu hóa một phần bẫy laser ở khu vực tiếp theo.",
      stage3_laser_off:
        "Lưới laser ở khu vực phía trước đã bị tắt. Hãy nhanh chóng di chuyển qua khu vực an toàn mới.",
      stage2_mode_exit_guarded:
        "Cấu hình hiện tại ưu tiên bảo vệ lối ra. Hàng rào laser ở hành lang dưới vẫn đang hoạt động.",
      stage2_mode_exit_relaxed:
        "Cấu hình hiện tại giảm giám sát ở gần EXIT và mở hành lang dưới. Một tuyến đường an toàn hơn đã xuất hiện.",
      stage2_lower_corridor_hint:
        "Các kỹ sư nói rằng cấu hình an ninh có thể chuyển nguồn khỏi hàng rào laser ở hành lang dưới.",

      stage1_room_fake:
        "Dọc theo dãy phòng còn có vài máy trạm trông giống console chính, nhưng chỉ là hệ thống phụ. " +
        "Đừng để bị đánh lạc hướng và lãng phí quá nhiều thời gian ở đó.",
      stage1_room_lore:
        "Một số phòng chứa màn hình giám sát và tài liệu nghiên cứu. " +
        "Nếu có thời gian, chúng có thể hé lộ lý do khu vực này bị phong tỏa.",
      stage1_room_mutant:
        "Có một phòng thí nghiệm bị phong ấn với dấu vết của thí nghiệm thất bại. " +
        "Nếu bên trong vẫn còn thứ gì đó sống, tốt nhất đừng ở lại đó quá lâu.",

      // Objective text
      stage1_objective_title: "Nhiệm vụ chính",
      stage1_objective_desc:
        "Truy cập máy console chính trong phòng lab để tải dữ liệu mật, sau đó mới được chạy tới cửa EXIT.",
      stage1_objective_done:
        "Đã tải xong dữ liệu. Bây giờ hãy tới cửa EXIT để trốn thoát.",
      stage1_objective_need_data:
        "Chưa thể rời khỏi đây. Hãy tải dữ liệu từ máy console chính trước.",
      stage1_laser_off:
        "Đã vô hiệu hóa hệ thống tia laser đang chắn lối EXIT.",
      stage1_laser_dead:
        "Bạn đã kích hoạt hệ thống tia laser ở cửa EXIT. Chú ý: phải tìm bảng điều khiển phụ trong phòng trống dưới bên phải và nhấn E để vô hiệu hóa laser trước khi quay lại.",
      stage3_turret_dead:
        "Bạn đã bị trụ súng bắn hạ. Hãy chú ý vùng chiếu của trụ súng và né khi nó nhắm vào bạn.",
      stage1_laser_hint:
        "Đây là bảng điều khiển phụ của hệ thống laser. Nhấn E để vô hiệu hóa tia laser đang chắn lối EXIT.",
      stage1_fail_guard: "Bạn đã bị lính gác phát hiện và bắt giữ.",
      stage1_clue_fake_console:
        "Máy trạm này chỉ có quyền đọc dữ liệu cục bộ. Không thể mở khóa hệ thống trung tâm từ đây.",
      stage1_clue_lore_logs:
        "Log hệ thống nhắc đến một 'data hub' đặt trong phòng lab chính ở phía bên phải hành lang.",
      stage1_clue_mutant_tank:
        "Báo cáo dở dang: 'Subject #3 phản ứng cực kỳ mạnh với tiếng động và chuyển động trong phòng thí nghiệm.'",
      stage2_clue_src_main:
        "Bảng điều phối an ninh chính. Từ đây có thể chuyển nguồn giữa cụm camera hành lang và các cửa phụ. Cấu hình đúng sẽ tắt bớt camera ở giữa hành lang và mở dần các lớp khóa hướng ra EXIT.",
      stage2_clue_src_corridor:
        "Bảng hành lang hiển thị tải camera. Chuyển điện sang cửa sẽ tắt vài camera, nhưng đường đi an toàn sẽ đổi; cần khớp với cấu hình ở bảng chính.",
      stage2_clue_src_exit:
        "Bảng phụ gần EXIT. Chỉ mở khóa khi cấu hình nguồn từ bảng chính và hành lang khớp; điện áp sai sẽ giữ khoá và camera vẫn bật.",
      stage2_clue_main:
        "Trung tâm điều phối an ninh. Tài liệu nội bộ nói rằng các chế độ BLUE / RED / GREEN sẽ phân phối lại điện giữa camera và khóa cửa.",
      stage2_clue_corridor:
        "Bảng điều khiển giám sát camera ở hành lang. Nếu chuyển tải sang cửa, một số camera sẽ tắt bớt nhưng đường đi an toàn sẽ thay đổi.",
      stage2_clue_exit:
        "Bảng điều khiển phụ gần cửa EXIT. Khi cấu hình ở phòng điều khiển đúng, một vài lớp khóa ở lối thoát sẽ được mở."
    },

    // ================= KOREAN =================
    ko: {
      title: "가드 이스케이프",
      hud_alert: "경계 수준",
      hud_status_playing: "잠입 중",
      hud_status_fail: "발각됨!",
      hud_status_clear: "임무 완료",
      hud_lang_label: "언어",
      hud_decoy: "디코이",
      pause_title: "일시 정지",
      pause_resume: "계속하기",
      pause_retry: "다시 시작",
      pause_menu: "메인으로",

      stage1_story:
        "비밀 연구소의 지하 보안 구역. 당신은 첫 보안문을 통과했습니다. " +
        "경비원을 피해 들키지 않고 탈출구를 찾아야 합니다.",

      tutorial_move:
        "W A S D 키 또는 방향키로 이동합니다. Shift를 누르면 더 빨리 달릴 수 있습니다.",
      tutorial_goal:
        "목표: 경비원의 시야(삼각형 영역)를 피하면서 화면 오른쪽의 EXIT 문에 도달하면 스테이지 클리어입니다.",
      tutorial_actions:
        "액션: F 키로 소음을 내는 디코이(decoy)를 던질 수 있습니다. " +
        "발각되면 경계 수준이 올라가고 경비가 추격합니다.",
      tutorial_hint: "계속하려면 Space 또는 Enter 키를 누르세요…",
      tutorial_inspect:
        "장비나 기계, 실험 탱크 근처에 다가가면 E 키를 눌러 확인할 수 있습니다. " +
        "어떤 곳에는 데이터와 비밀 실험에 대한 중요한 단서가 남아 있을 수 있습니다.",
      stage2_story:
        "당신은 실험실 층을 탈출했습니다. 이제 모든 카메라와 잠금 장치를 제어하는 보안 허브 층입니다. 감시망을 피해 조용히 시설에서 탈출하세요.",
      stage2_goal:
        "목표: 보안 콘솔을 재구성하여 레이저 게이트를 해제하고 EXIT 문까지 도달하세요.",
      stage3_story:
        "시설의 핵심 구역에 도착했습니다. 이 층은 자동 함정과 실험용 방어 장치들로 가득 찬 살벌한 구역입니다. 한 번만 실수해도 레이저 그리드가 전부 켜질 수 있습니다.",
      stage3_goal:
        "목표: 바닥 곳곳의 콘솔과 스위치를 이용해 레이저 그리드와 터렛을 충분히 비활성화한 뒤, 맵 오른쪽 끝의 EXIT 게이트까지 도달하세요.",
      stage3_traps:
        "경고: 이 구역에는 터렛의 총알, 바닥 레이저 스파이크, 세로 레이저 게이트가 함께 배치되어 있습니다. 각 콘솔에서 뻗어나가는 붉은 선을 보고 어떤 함정을 제어하는지 파악하세요.",
      stage2_objective_hint:
        "[E] 키를 눌러 메인 보안 콘솔을 해킹하고 보안 설정을 적용하세요.",
      stage2_objective_done:
        "보안 설정이 적용되었습니다. 탈출 경로가 달라졌을 수 있습니다.",
      stage2_objective_need_data:
        "이 층을 떠나기 전에 콘솔을 먼저 해킹해야 합니다.",
      stage2_laser_hint:
        "출구 옆 콘솔이 레이저 게이트를 제어하는 것 같습니다.",
      stage2_laser_off:
        "레이저 게이트가 비활성화되었습니다. 여전히 보안이 작동하고 있으니 주의하세요.",
      stage3_laser_hint:
        "이 바닥 스위치는 다음 구역의 레이저 함정을 일부 비활성화합니다.",
      stage3_laser_off:
        "앞 구역의 레이저 그리드가 꺼졌습니다. 새로 열린 안전 구역을 이용해 이동하세요.",
      stage2_mode_exit_guarded:
        "현재 설정은 출구 보호를 우선시합니다. 아래쪽 복도의 레이저 장벽이 여전히 활성화되어 있습니다.",
      stage2_mode_exit_relaxed:
        "현재 설정은 EXIT 근처의 감시를 줄이고 아래쪽 복도를 엽니다. 더 안전한 경로가 생겼습니다.",
      stage2_lower_corridor_hint:
        "엔지니어들은 보안 설정으로 아래쪽 복도의 레이저 장벽에서 전원을 우회할 수 있다고 말했습니다.",

      stage1_room_fake:
        "양쪽 복도에는 메인 콘솔처럼 보이는 단말기들이 몇 개 더 있습니다. 대부분은 보조 장비일 뿐이니, " +
        "쓸데없이 시간을 낭비하지 마십시오.",
      stage1_room_lore:
        "어떤 방에는 모니터와 연구 로그들이 남아 있습니다. " +
        "여유가 있다면 이 구역이 왜 폐쇄되었는지 단서를 얻을 수 있을지도 모릅니다.",
      stage1_room_mutant:
        "봉인된 실험실 하나에서는 실패한 실험의 흔적이 보입니다. " +
        "안에 아직 살아 있는 것이 있다면, 움직임에 매우 공격적으로 반응할 것입니다.",

      // Objective text
      stage1_objective_title: "주요 임무",
      stage1_objective_desc:
        "연구실의 메인 콘솔에서 기밀 데이터를 다운로드한 뒤에야 EXIT 문으로 탈출할 수 있습니다.",
      stage1_objective_done:
        "데이터 다운로드 완료. 이제 EXIT 문으로 이동해 탈출하세요.",
      stage1_objective_need_data:
        "아직 떠날 수 없습니다. 먼저 메인 콘솔에서 데이터를 확보해야 합니다.",
      stage1_laser_off:
        "EXIT 쪽을 막고 있던 레이저 보안 장치를 해제했습니다.",
      stage1_laser_dead:
        "EXIT 앞의 레이저 장벽을 작동시켰습니다. 먼저 아래 오른쪽 빈 방에 있는 보조 콘솔을 찾아 E 키로 레이저를 해제해야 합니다.",
      stage3_turret_dead:
        "터렛의 총알에 맞았습니다. 터렛의 시야 범위를 주의해서 피하세요.",
      stage1_laser_hint:
        "레이저 시스템의 보조 콘솔입니다. EXIT를 막고 있는 레이저를 해제하려면 E 키를 누르세요.",
      stage1_fail_guard: "경비병에게 발각되어 붙잡혔습니다.",
      stage1_clue_fake_console:
        "이 단말기는 로컬 데이터 조회 권한만 있습니다. 여기서는 중앙 시스템 잠금을 해제할 수 없습니다.",
      stage1_clue_lore_logs:
        "시스템 로그에는 복도 오른쪽에 있는 메인 실험실에 '데이터 허브'가 설치되어 있다고 적혀 있습니다.",
      stage1_clue_mutant_tank:
        "미완성 보고서: '실험체 #3는 실험실 내부의 소리와 움직임에 매우 과민하게 반응한다.'",
      stage2_clue_src_main:
        "보안 메인 라우팅 콘솔. 여기서 복도 카메라와 보조 도어 사이 전력을 전환할 수 있다. 올바르게 설정하면 중앙 복도 카메라가 일부 꺼지고 EXIT 쪽 잠금이 단계적으로 해제된다.",
      stage2_clue_src_corridor:
        "복도 패널은 카메라 부하를 보여준다. 전력을 도어로 돌리면 몇몇 카메라가 꺼지지만 안전 경로가 바뀌므로 메인 콘솔 설정과 맞춰야 한다.",
      stage2_clue_src_exit:
        "EXIT 근처 보조 패널. 메인/복도 설정이 맞을 때만 잠금이 풀리고 카메라도 일부 비활성화된다; 전력이 맞지 않으면 여전히 잠겨 있다.",
      stage2_clue_main:
        "보안 시스템의 라우팅 메인 콘솔이다. 내부 문서에 따르면 BLUE / RED / GREEN 모드에 따라 전력이 카메라와 도어 잠금 장치 사이에 다르게 분배된다.",
      stage2_clue_corridor:
        "복도 구간의 카메라 트래픽을 모니터링하는 패널이다. 전력을 도어 쪽으로 돌리면 일부 카메라가 꺼지지만 안전한 이동 경로가 달라질 수 있다.",
      stage2_clue_exit:
        "EXIT 근처의 보조 콘솔이다. 제어실에서 올바른 모드로 설정되면 출구 쪽 잠금 장치 일부가 해제된다."
    },

    // ================= ENGLISH =================
    en: {
      title: "Guard Escape",
      hud_alert: "Alert Level",
      hud_status_playing: "Infiltrating",
      hud_status_fail: "Detected!",
      hud_status_clear: "Mission Complete",
      hud_lang_label: "Language",
      hud_decoy: "Decoy",
      pause_title: "Paused",
      pause_resume: "Resume",
      pause_retry: "Retry",
      pause_menu: "Menu",

      stage1_story:
        "Underground security level of a secret research facility. You just slipped past the first checkpoint. " +
        "Now you must sneak past the guards and find the exit without being seen.",

      tutorial_move:
        "Move with W A S D or the arrow keys. Hold Shift to run faster.",
      tutorial_goal:
        "Goal: Avoid the guards' vision cones and reach the EXIT door on the right side of the map to clear the stage.",
      tutorial_actions:
        "Actions: Press F to throw a noise decoy and lure guards away. " +
        "If you are detected, the alert level rises and guards will chase you.",
      tutorial_hint: "Press Space or Enter to continue…",
      tutorial_inspect:
        "When you approach terminals, devices or experiment tanks, press E to inspect them. " +
        "Some spots contain important clues about the data and the secret experiments.",
      stage2_story:
        "You escaped the lab floor. Ahead is the main Security Hub, where all cameras and locks are controlled. Slip through the surveillance system and escape the facility.",
      stage2_goal:
        "Goal: Reconfigure the security consoles, disable the laser gate, and reach the EXIT door.",
      stage3_story:
        "You reached the facility's core sector. This floor is a killbox packed with automated traps and experimental defenses. One wrong step and the whole laser grid lights up.",
      stage3_goal:
        "Goal: Use the floor consoles and switches to disable enough laser grids and turrets, then reach the EXIT gate at the far right of the map.",
      stage3_traps:
        "Warning: This sector combines turret bullets, floor laser spikes, and vertical laser gates. Watch enemy sight cones and the red lines from each console to understand which traps they control.",
      stage2_objective_hint:
        "Hold [E] to hack the main security console and apply the security configuration.",
      stage2_objective_done:
        "Security configuration applied. The escape route may have changed.",
      stage2_objective_need_data:
        "You must hack the console before you can leave this floor.",
      stage2_laser_hint:
        "It looks like the console next to the exit controls the laser gate.",
      stage2_laser_off:
        "The laser gate is now disabled. Stay alert—security is still active.",
      stage3_laser_hint:
        "This floor switch will disable part of the laser traps ahead. Use it to open a safer path.",
      stage3_laser_off:
        "The laser grid in the upcoming area has been disabled. Move through the newly safe section quickly.",
      stage2_mode_exit_guarded:
        "Current configuration prioritizes guarding the exit. The laser fence in the lower corridor remains active.",
      stage2_mode_exit_relaxed:
        "Current configuration reduces surveillance near the EXIT and opens the lower corridor. A safer route has appeared.",
      stage2_lower_corridor_hint:
        "Engineers mentioned the security configuration can divert power away from the laser fence in the lower corridor.",
      stage2_after_hack_hint:
        "Hack complete. The system now allows you to reconfigure security.\nStand next to this console and press E again to switch the configuration and open a new route.",
      stage2_hint_reconfigure_action:
        "[E] Reconfigure security route",
      stage2_mode_exit_guarded:
        "Current configuration prioritizes guarding the exit. The laser fence in the lower corridor remains active.",
      stage2_mode_exit_relaxed:
        "Current configuration reduces surveillance near the EXIT and opens the lower corridor. A safer route has appeared.",
      stage2_lower_corridor_hint:
        "Engineers mentioned the security configuration can divert power away from the laser fence in the lower corridor.",

      stage1_room_fake:
        "Along the corridors there are several workstations that look like the main console, " +
        "but most of them are just secondary terminals. Don’t waste too much time on them.",
      stage1_room_lore:
        "Some rooms are filled with monitors and research logs. " +
        "If you have time, they may reveal why this sector was locked down.",
      stage1_room_mutant:
        "One sealed lab shows clear signs of a failed experiment. " +
        "If something is still alive inside, it will react violently to any movement.",

      // Objective text
      stage1_objective_title: "Main Objective",
      stage1_objective_desc:
        "Access the main lab console and download the confidential data before heading to the EXIT door.",
      stage1_objective_done:
        "Data download complete. Now move to the EXIT door to escape.",
      stage1_objective_need_data:
        "You can't leave yet. Secure the data from the main console first.",
      stage1_laser_off:
        "Laser security around the EXIT has been disabled.",
      stage1_laser_dead:
        "You triggered the laser barrier at the EXIT. You must find the auxiliary control console in the bottom-right empty room and press E to disable the lasers before trying again.",
      stage3_turret_dead:
        "You were shot by a turret. Watch the turret's cone and dodge when it aims at you.",
      stage1_laser_hint:
        "This is the auxiliary console for the laser system. Press E to disable the laser barrier blocking the EXIT.",
      stage1_fail_guard: "You were spotted and captured by the guards.",
      stage1_clue_fake_console:
        "This workstation only has permission to read local data. You can’t unlock the central system from here.",
      stage1_clue_lore_logs:
        "The system logs mention a 'data hub' installed in the main lab on the right side of the corridor.",
      stage1_clue_mutant_tank:
        "Unfinished report: 'Subject #3 reacts violently to noise and movement inside the lab.'",
      stage2_clue_src_main:
        "Main security routing console. Lets you reroute power between corridor cameras and auxiliary doors. Correct config shuts down some mid-corridor cameras and gradually frees locks toward the EXIT.",
      stage2_clue_src_corridor:
        "Corridor panel shows camera load. Sending power to doors disables some cameras but changes which paths are safe; must align with the main console.",
      stage2_clue_src_exit:
        "Auxiliary console near the EXIT. Only unlocks when power settings from main and corridor panels align; wrong routing keeps locks engaged and cameras alive.",
      stage2_clue_main:
        "Main routing console for the security system. Internal docs mention BLUE / RED / GREEN modes that redistribute power between cameras and door locks.",
      stage2_clue_corridor:
        "Panel monitoring camera traffic in the central corridor. Shifting power to the doors turns off some cameras, but it changes which routes are safe.",
      stage2_clue_exit:
        "Auxiliary console near the EXIT. When the control room is configured correctly, some of the locks on the exit will be released."
    }
  },

  // translate key -> current language string
  t: function (key) {
    var lang = this.current;
    var dict = this.strings[lang] || this.strings.en;
    return (
      (dict && dict[key]) ||
      (this.strings.en && this.strings.en[key]) ||
      key
    );
  },

  // Alias cho UI.getText()
  get: function (key) {
    return this.t(key);
  },

  // change language and refresh UI
  setLanguage: function (lang) {
    if (!this.strings[lang]) return;
    this.current = lang;
    console.log("[I18N] language ->", lang);

    if (typeof window !== "undefined" && window.UI && typeof UI.refresh === "function") {
      UI.refresh();
    }
  }
};

// đảm bảo có window.I18N (trình duyệt)
if (typeof window !== "undefined") {
  window.I18N = I18N;
}

var savedLang = null;
try {
  savedLang = localStorage.getItem("lang");
} catch (e) {}

if (savedLang && I18N.strings[savedLang]) {
  I18N.setLanguage(savedLang);
} else {
  I18N.setLanguage("ko");
}
