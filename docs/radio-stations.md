# 라디오 주파수 자료

확인 기준일: 2026-10-21. 방송사 공식 주파수 안내를 기준으로 등록했습니다. 아래 MHz 값은 코드에서 정수 kHz로 저장합니다. 인터넷 스트림의 수신 가능 지역을 제한하는 값이 아니라 지역별 FM 튜너를 표시하기 위한 대표 주파수입니다.

조작 화면은 15개 지역으로 나눕니다. 부산·울산·경남, 대구·경북, 광주·전남, 대전·세종·충남을 각각 분리해 FM 드롭다운이 지역당 하나에 들어갑니다. 아래 자료 표는 기존 9개 권역을 기준으로 정리한 것이며, 방송 URL·ID·주파수는 그대로 유지합니다. 이전 권역으로 저장된 재생 상태도 분리된 지역으로 복원합니다.

지역과 안정적인 방송국 ID를 함께 저장하며, 같은 EBS 스트림도 지역별 주파수는 다릅니다. 다중 송신소 중 대표 지역 값을 사용하고, 국방FM의 경북 항목은 포항·영덕, 제주 항목은 서귀포입니다. 같은 주파수 방송국은 목록에서 모두 선택할 수 있습니다. 좌우 탐색은 같은 주파수를 건너뛰고, 다음 주파수에서는 ID 순 첫 방송국을 선택하며 양 끝에서 순환합니다.

`fm`은 공식 주파수를 확인한 채널, `other`는 인터넷·AM 등 기타 채널, `unknown`은 주파수 미확인 채널입니다. `unknown`을 인터넷 전용으로 간주하지 않습니다. 두 후자는 FM 자동 탐색에서 제외하고 별도 목록에 유지합니다. URL 분류 함수는 인증 수단이 아니며, 재생은 정확한 카탈로그 URL로만 허용합니다.

## 서울·수도권 (`seoul`)

| 방송국 ID | 방송국 | FM MHz | 대표 지역 | 근거 |
|---|---|---|---|---|
| `kbs:1radio:default` | KBS 1라디오 | 97.3 | 서울·수도권 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:2radio:default` | KBS 2라디오 | 106.1 | 서울·수도권 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:3radio:default` | KBS 3라디오 | 104.9 | 서울·수도권 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1fm:default` | KBS 1FM | 93.1 | 서울·수도권 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:2fm:default` | KBS 2FM | 89.1 | 서울·수도권 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:hanminjok:default` | KBS 한민족방송 | 인터넷·기타 | — | — |
| `mbc:sfm:default` | MBC 표준FM | 95.9 | 서울·수도권 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:default` | MBC FM4U | 91.9 | 서울·수도권 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:chm:default` | MBC mini 올댓뮤직 | 인터넷·기타 | — | — |
| `mbc:bora:default` | MBC 보이는 라디오 | 인터넷·기타 | — | — |
| `sbs:lovefm:default` | SBS 러브FM | 103.5 | 서울·수도권 | [공식 안내](https://www.sbs.co.kr/radio/frequency.html?div=gnb_program) |
| `sbs:powerfm:default` | SBS 파워FM | 107.7 | 서울·수도권 | [공식 안내](https://www.sbs.co.kr/radio/frequency.html?div=gnb_program) |
| `sbs:dmb:default` | SBS 고릴라디오M | 인터넷·기타 | — | — |
| `ebs:fm:default` | EBS FM | 104.5 | 서울·수도권 | [공식 안내](https://www.ebs.co.kr/customer/introduce/watching/radiofrequency) |
| `ebs:bandi:default` | EBS 반디 외국어 전문 | 인터넷·기타 | — | — |
| `obs:default:default` | OBS 라디오 | 99.9 | 서울·수도권 | [공식 안내](https://www.obsnews.co.kr/news/articleView.html?idxno=1436323) |
| `ifm:default:default` | iFM 경인방송 | 90.7 | 서울·수도권 | [공식 안내](https://www.ifm.kr/) |
| `ytn:default:default` | YTN 라디오 | 94.5 | 서울·수도권 | [공식 안내](https://inside.ytn.co.kr/archive/4_Radio_kor.pdf) |
| `tbs:fm:default` | TBS FM | 95.1 | 서울·수도권 | [공식 안내](https://tbs.seoul.kr/introduce/tbsethics.do) |
| `tbs:efm:default` | TBS eFM | 101.3 | 서울·수도권 | [공식 안내](https://tbs.seoul.kr/introduce/tbsethics.do) |
| `tbn:default:default` | TBN 경인교통방송 | 100.5 | 서울·수도권 | [공식 안내](https://www.tbn.or.kr/) |
| `cbs:sfm:default` | CBS 표준FM | 98.1 | 서울·수도권 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:mfm:default` | CBS 음악FM | 93.9 | 서울·수도권 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:joy4u:default` | CBS JOY4U | 인터넷·기타 | — | — |
| `febc:default:default` | FEBC 서울극동방송 | 106.9 | 서울·수도권 | [공식 안내](https://pohang.febc.net/intro/nationwide) |
| `bbs:default:default` | BBS 서울불교방송 | 101.9 | 서울·수도권 | [공식 안내](https://www.bbsi.co.kr/HOME/about/about_channel.html?leftPos=channel) |
| `cpbc:default:default` | CPBC 가톨릭평화방송 | 105.3 | 서울·수도권 | [공식 안내](https://web.cpbc.co.kr/company/page/page4.html) |
| `wbs:default:default` | WBS 서울원음방송 | 89.7 | 서울·수도권 | [공식 안내](https://wbsi.kr/) |
| `kookbang:default:default` | 국방FM | 96.7 | 서울·수도권 | [공식 안내](https://radio.dema.mil.kr/web/radio/inform/frequency.do) |
| `kugak:default:default` | 국악방송 | 99.1 | 서울·수도권 | [공식 안내](https://igbf.kr/gugak_web/?sub_num=1844) |
| `afn:default:humphreys` | AFN FM Humphreys | 주파수 미확인 | — | — |
| `community:gwanakfm:default` | 관악FM | 주파수 미확인 | — | — |
| `community:mapofm:default` | 마포FM | 주파수 미확인 | — | — |
| `community:seongnamfm:default` | 성남FM | 주파수 미확인 | — | — |
| `community:sdmfm:default` | 서대문FM | 주파수 미확인 | — | — |
| `community:sonefm:default` | 수원FM | 주파수 미확인 | — | — |
| `community:gurifm:default` | GO구리FM | 주파수 미확인 | — | — |
| `community:dwfm:default` | 단원FM | 주파수 미확인 | — | — |

## 부산·울산·경남 (`busan`)

| 방송국 ID | 방송국 | FM MHz | 대표 지역 | 근거 |
|---|---|---|---|---|
| `kbs:1radio:busan` | KBS부산 1라디오 | 103.7 | 부산 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:2radio:busan` | KBS부산 2라디오 | 97.1 | 부산 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1fm:busan` | KBS부산 음악FM | 92.7 | 부산 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1radio:ulsan` | KBS울산 1라디오 | 90.7 | 울산 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1radio:changwon` | KBS창원 1라디오 | 91.7 | 창원 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:2radio:changwon` | KBS창원 2라디오 | 106.1 | 창원 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1fm:changwon` | KBS창원 음악FM | 93.9 | 창원 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1radio:jinju` | KBS진주 1라디오 | 90.3 | 진주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `mbc:sfm:busan` | 부산MBC 표준FM | 95.9 | 부산 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:busan` | 부산MBC FM4U | 88.9 | 부산 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:sfm:ulsan` | 울산MBC 표준FM | 97.5 | 울산 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:ulsan` | 울산MBC FM4U | 98.7 | 울산 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:sfm:changwon` | MBC경남 표준FM | 98.9 | 창원 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:changwon` | MBC경남 FM4U | 100.5 | 창원 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `sbs:lovefm:busan` | KNN 러브FM | 105.7 | 부산 | [공식 안내](https://www.sbs.co.kr/radio/frequency.html?div=gnb_program) |
| `sbs:powerfm:busan` | KNN 파워FM | 99.9 | 부산 | [공식 안내](https://www.sbs.co.kr/radio/frequency.html?div=gnb_program) |
| `sbs:powerfm:ulsan` | UBC 그린FM | 92.3 | 울산 | [공식 안내](https://www.sbs.co.kr/radio/frequency.html?div=gnb_program) |
| `ebs:fm:default` | EBS FM | 107.7 | 부산 | [공식 안내](https://www.ebs.co.kr/customer/introduce/watching/radiofrequency) |
| `ebs:bandi:default` | EBS 반디 외국어 전문 | 인터넷·기타 | — | — |
| `tbn:default:busan` | TBN 부산교통방송 | 94.9 | 부산 | [공식 안내](https://www.tbn.or.kr/) |
| `tbn:default:ulsan` | TBN 울산교통방송 | 104.1 | 울산 | [공식 안내](https://www.tbn.or.kr/) |
| `tbn:default:gyeongnam` | TBN 경남교통방송 | 95.5 | 경남 | [공식 안내](https://www.tbn.or.kr/) |
| `cbs:sfm:busan` | 부산CBS 표준FM | 102.9 | 부산 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:mfm:busan` | 부산CBS 음악FM | 102.1 | 부산 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:sfm:ulsan` | 울산CBS 표준FM | 100.3 | 울산 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:sfm:gyeongnam` | 경남CBS 표준FM | 106.9 | 경남 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:joy4u:default` | CBS JOY4U | 인터넷·기타 | — | — |
| `febc:default:busan` | FEBC 부산극동방송 | 93.3 | 부산 | [공식 안내](https://pohang.febc.net/intro/nationwide) |
| `febc:default:ulsan` | FEBC 울산극동방송 | 107.3 | 울산 | [공식 안내](https://pohang.febc.net/intro/nationwide) |
| `febc:default:changwon` | FEBC 창원극동방송 | 98.1 | 창원 | [공식 안내](https://pohang.febc.net/intro/nationwide) |
| `bbs:default:busan` | BBS 부산불교방송 | 89.9 | 부산 | [공식 안내](https://www.bbsi.co.kr/HOME/about/about_channel.html?leftPos=channel) |
| `cpbc:default:busan` | CPBC 부산가톨릭평화방송 | 101.1 | 부산 | [공식 안내](https://web.cpbc.co.kr/company/page/page4.html) |
| `wbs:default:busan` | WBS 부산원음방송 | 104.9 | 부산 | [공식 안내](https://wbsi.kr/) |
| `kookbang:default:default` | 국방FM | 주파수 미확인 | — | — |
| `befm:default:default` | 부산영어방송 | 90.5 | 서울·수도권 | [공식 안내](https://www.busan.go.kr/nbtnewsBU/1664410) |
| `community:yeonjefm:default` | 연제공동체라디오 | 주파수 미확인 | — | — |
| `community:namhaefm:default` | 남해FM | 주파수 미확인 | — | — |

## 대구·경북 (`daegu`)

| 방송국 ID | 방송국 | FM MHz | 대표 지역 | 근거 |
|---|---|---|---|---|
| `kbs:1radio:daegu` | KBS대구 1라디오 | 101.3 | 대구 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:2radio:daegu` | KBS대구 2라디오 | 102.3 | 대구 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1fm:daegu` | KBS대구 음악FM | 89.7 | 대구 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1radio:andong` | KBS안동 1라디오 | 90.5 | 안동 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1radio:pohang` | KBS포항 1라디오 | 95.9 | 포항 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `mbc:sfm:daegu` | 대구MBC 표준FM | 96.5 | 대구 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:daegu` | 대구MBC FM4U | 95.3 | 대구 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:sfm:andong` | 안동MBC 표준FM | 100.1 | 안동 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:andong` | 안동MBC FM4U | 91.3 | 안동 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:sfm:pohang` | 포항MBC 표준FM | 100.7 | 포항 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:pohang` | 포항MBC FM4U | 97.9 | 포항 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `sbs:powerfm:daegu` | TBC 드림FM | 99.3 | 대구 | [공식 안내](https://www.sbs.co.kr/radio/frequency.html?div=gnb_program) |
| `ebs:fm:default` | EBS FM | 105.1 | 대구 | [공식 안내](https://www.ebs.co.kr/customer/introduce/watching/radiofrequency) |
| `ebs:bandi:default` | EBS 반디 외국어 전문 | 인터넷·기타 | — | — |
| `tbn:default:daegu` | TBN 대구교통방송 | 103.9 | 대구 | [공식 안내](https://www.tbn.or.kr/) |
| `tbn:default:gyeongbuk` | TBN 경북교통방송 | 103.5 | 경북 | [공식 안내](https://www.tbn.or.kr/) |
| `cbs:sfm:daegu` | 대구CBS 표준FM | 103.1 | 대구 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:mfm:daegu` | 대구CBS 음악FM | 97.1 | 대구 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:sfm:pohang` | 포항CBS 표준FM | 91.5 | 포항 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:joy4u:default` | CBS JOY4U | 인터넷·기타 | — | — |
| `febc:default:daegu` | FEBC 대구극동방송 | 91.9 | 대구 | [공식 안내](https://pohang.febc.net/intro/nationwide) |
| `febc:default:pohang` | FEBC 포항극동방송 | 90.3 | 포항 | [공식 안내](https://pohang.febc.net/intro/nationwide) |
| `bbs:default:daegu` | BBS 대구불교방송 | 94.5 | 대구 | [공식 안내](https://www.bbsi.co.kr/HOME/about/about_channel.html?leftPos=channel) |
| `cpbc:default:daegu` | CPBC 대구가톨릭평화방송 | 93.1 | 대구 | [공식 안내](https://web.cpbc.co.kr/company/page/page4.html) |
| `wbs:default:daegu` | WBS 대구원음방송 | 98.3 | 대구 | [공식 안내](https://wbsi.kr/) |
| `kookbang:default:default` | 국방FM | 92.7 | 포항·영덕 | [공식 안내](https://radio.dema.mil.kr/web/radio/inform/frequency.do) |
| `afn:default:daegu` | AFN FM Daegu | 주파수 미확인 | — | — |
| `community:scnfm:default` | 성서공동체FM | 주파수 미확인 | — | — |
| `community:daegufm:default` | 대구동구FM | 주파수 미확인 | — | — |
| `community:yeongjufm:default` | 영주FM | 주파수 미확인 | — | — |
| `community:sjfm:default` | 성주FM | 주파수 미확인 | — | — |
| `community:sangjufm:default` | 상주FM | 주파수 미확인 | — | — |

## 광주·전남 (`gwangju`)

| 방송국 ID | 방송국 | FM MHz | 대표 지역 | 근거 |
|---|---|---|---|---|
| `kbs:1radio:gwangju` | KBS광주 1라디오 | 90.5 | 광주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:2radio:gwangju` | KBS광주 2라디오 | 95.5 | 광주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1fm:gwangju` | KBS광주 음악FM | 92.3 | 광주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1radio:mokpo` | KBS목포 1라디오 | 105.9 | 목포 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1fm:mokpo` | KBS목포 음악FM | 98.3 | 목포 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1radio:suncheon` | KBS순천 1라디오 | 95.7 | 순천 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `mbc:sfm:gwangju` | 광주MBC 표준FM | 93.9 | 광주 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:gwangju` | 광주MBC FM4U | 91.5 | 광주 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:sfm:mokpo` | 목포MBC 표준FM | 89.1 | 목포 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:mokpo` | 목포MBC FM4U | 102.3 | 목포 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:sfm:yeosu` | 여수MBC 표준FM | 100.3 | 여수 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:yeosu` | 여수MBC FM4U | 98.3 | 여수 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `sbs:powerfm:gwangju` | KBC 마이FM | 101.1 | 광주 | [공식 안내](https://www.sbs.co.kr/radio/frequency.html?div=gnb_program) |
| `ebs:fm:default` | EBS FM | 105.3 | 광주 | [공식 안내](https://www.ebs.co.kr/customer/introduce/watching/radiofrequency) |
| `ebs:bandi:default` | EBS 반디 외국어 전문 | 인터넷·기타 | — | — |
| `tbn:default:gwangju` | TBN 광주교통방송 | 97.3 | 광주 | [공식 안내](https://www.tbn.or.kr/) |
| `cbs:sfm:gwangju` | 광주CBS 표준FM | 103.1 | 광주 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:mfm:gwangju` | 광주CBS 음악FM | 98.1 | 광주 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:sfm:jeonnam` | 전남CBS 표준FM | 102.1 | 전남 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:joy4u:default` | CBS JOY4U | 인터넷·기타 | — | — |
| `febc:default:gwangju` | FEBC 광주극동방송 | 93.1 | 광주 | [공식 안내](https://pohang.febc.net/intro/nationwide) |
| `febc:default:mokpo` | FEBC 목포극동방송 | 100.5 | 목포 | [공식 안내](https://pohang.febc.net/intro/nationwide) |
| `febc:default:jeonnam` | FEBC 전남동부극동방송 | 97.5 | 전남 | [공식 안내](https://pohang.febc.net/intro/nationwide) |
| `bbs:default:gwangju` | BBS 광주불교방송 | 89.7 | 광주 | [공식 안내](https://www.bbsi.co.kr/HOME/about/about_channel.html?leftPos=channel) |
| `cpbc:default:gwangju` | CPBC 광주가톨릭평화방송 | 99.9 | 광주 | [공식 안내](https://web.cpbc.co.kr/company/page/page4.html) |
| `wbs:default:gwangju` | WBS 광주원음방송 | 107.9 | 광주 | [공식 안내](https://wbsi.kr/) |
| `kookbang:default:default` | 국방FM | 96.5 | 광주 | [공식 안내](https://radio.dema.mil.kr/web/radio/inform/frequency.do) |
| `ggn:default:default` | 글로벌광주방송 | 주파수 미확인 | — | — |
| `kugak:default:gwangju` | 광주국악방송 | 99.3 | 광주 | [공식 안내](https://igbf.kr/gugak_web/?sub_num=1844) |
| `community:kjfm:default` | 광주FM | 주파수 미확인 | — | — |
| `community:crfm:default` | GBS고려방송 | 주파수 미확인 | — | — |
| `community:suncheonfm:default` | 순천미디어네트워크 | 주파수 미확인 | — | — |

## 대전·세종·충남 (`daejeon`)

| 방송국 ID | 방송국 | FM MHz | 대표 지역 | 근거 |
|---|---|---|---|---|
| `kbs:1radio:daejeon` | KBS대전 1라디오 | 94.7 | 대전 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:2radio:daejeon` | KBS대전 2라디오 | 100.9 | 대전 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1fm:daejeon` | KBS대전 음악FM | 98.5 | 대전 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `mbc:sfm:daejeon` | 대전MBC 표준FM | 92.5 | 대전 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:daejeon` | 대전MBC FM4U | 97.5 | 대전 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `sbs:powerfm:daejeon` | TJB 파워FM | 95.7 | 대전 | [공식 안내](https://www.sbs.co.kr/radio/frequency.html?div=gnb_program) |
| `ebs:fm:default` | EBS FM | 105.7 | 대전 | [공식 안내](https://www.ebs.co.kr/customer/introduce/watching/radiofrequency) |
| `ebs:bandi:default` | EBS 반디 외국어 전문 | 인터넷·기타 | — | — |
| `tbn:default:daejeon` | TBN 대전교통방송 | 102.9 | 대전 | [공식 안내](https://www.tbn.or.kr/) |
| `tbn:default:chungnam` | TBN 충남교통방송 | 103.9 | 충남 | [공식 안내](https://www.tbn.or.kr/) |
| `cbs:sfm:daejeon` | 대전CBS 표준FM | 91.7 | 대전 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:joy4u:default` | CBS JOY4U | 인터넷·기타 | — | — |
| `febc:default:daejeon` | FEBC 대전극동방송 | 93.3 | 대전 | [공식 안내](https://pohang.febc.net/intro/nationwide) |
| `kookbang:default:default` | 국방FM | 100.1 | 대전 | [공식 안내](https://radio.dema.mil.kr/web/radio/inform/frequency.do) |
| `kugak:default:daejeon` | 대전국악방송 | 90.5 | 대전 | [공식 안내](https://igbf.kr/gugak_web/?sub_num=1844) |
| `community:keumkangfm:default` | 금강FM | 주파수 미확인 | — | — |
| `community:sejongfm:default` | 세종FM | 주파수 미확인 | — | — |
| `community:hanbatfm:default` | 한밭FM | 주파수 미확인 | — | — |

## 강원 (`gangwon`)

| 방송국 ID | 방송국 | FM MHz | 대표 지역 | 근거 |
|---|---|---|---|---|
| `kbs:1radio:chuncheon` | KBS춘천 1라디오 | 99.5 | 춘천 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:2radio:chuncheon` | KBS춘천 2라디오 | 98.7 | 춘천 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1fm:chuncheon` | KBS춘천 음악FM | 91.1 | 춘천 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1radio:gangneung` | KBS강릉 1라디오 | 98.9 | 강릉 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1fm:gangneung` | KBS강릉 음악FM | 89.1 | 강릉 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1radio:wonju` | KBS원주 1라디오 | 97.1 | 원주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1fm:wonju` | KBS원주 음악FM | 89.5 | 원주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `mbc:sfm:chuncheon` | 춘천MBC 표준FM | 92.3 | 춘천 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:chuncheon` | 춘천MBC FM4U | 94.5 | 춘천 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:sfm:wonju` | 원주MBC 표준FM | 102.5 | 원주 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:wonju` | 원주MBC FM4U | 98.9 | 원주 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:sfm:gangneung` | MBC강원영동 표준FM | 96.3 | 강릉 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:gangneung` | MBC강원영동 FM4U | 94.3 | 강릉 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `sbs:powerfm:chuncheon` | G1 프레쉬FM | 105.1 | 춘천 | [공식 안내](https://www.sbs.co.kr/radio/frequency.html?div=gnb_program) |
| `ebs:fm:default` | EBS FM | 106.5 | 춘천 | [공식 안내](https://www.ebs.co.kr/customer/introduce/watching/radiofrequency) |
| `ebs:bandi:default` | EBS 반디 외국어 전문 | 인터넷·기타 | — | — |
| `tbn:default:gangwon` | TBN 강원교통방송 | 105.9 | 강원 | [공식 안내](https://www.tbn.or.kr/) |
| `cbs:sfm:chuncheon` | 춘천CBS 표준FM | 93.7 | 춘천 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:sfm:youngdong` | 강원영동CBS 표준FM | 91.5 | 강원 영동 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:joy4u:default` | CBS JOY4U | 인터넷·기타 | — | — |
| `febc:default:gangwon` | FEBC 강원극동방송 | 90.1 | 강원 영동 | [공식 안내](https://pohang.febc.net/intro/nationwide) |
| `kookbang:default:default` | 국방FM | 96.7 | 춘천 | [공식 안내](https://radio.dema.mil.kr/web/radio/inform/frequency.do) |
| `community:taebaekfm:default` | 태백FM | 주파수 미확인 | — | — |

## 충북 (`chungbuk`)

| 방송국 ID | 방송국 | FM MHz | 대표 지역 | 근거 |
|---|---|---|---|---|
| `kbs:1radio:cheongju` | KBS청주 1라디오 | 89.3 | 청주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:2radio:cheongju` | KBS청주 2라디오 | 90.9 | 청주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1fm:cheongju` | KBS청주 음악FM | 102.1 | 청주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1radio:chungju` | KBS충주 1라디오 | 92.1 | 충주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1fm:chungju` | KBS충주 음악FM | 100.3 | 충주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `mbc:sfm:cheongju` | MBC충북 표준FM | 107.1 | 청주 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:cheongju` | MBC충북 FM4U | 99.7 | 청주 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `sbs:powerfm:cheongju` | CJB 조이FM | 101.5 | 청주 | [공식 안내](https://www.sbs.co.kr/radio/frequency.html?div=gnb_program) |
| `ebs:fm:default` | EBS FM | 105.1 | 청주 | [공식 안내](https://www.ebs.co.kr/customer/introduce/watching/radiofrequency) |
| `ebs:bandi:default` | EBS 반디 외국어 전문 | 인터넷·기타 | — | — |
| `tbn:default:chungbuk` | TBN 충북교통방송 | 103.3 | 충북 | [공식 안내](https://www.tbn.or.kr/) |
| `cbs:sfm:cheongju` | 충북CBS 표준FM | 91.5 | 청주 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:joy4u:default` | CBS JOY4U | 인터넷·기타 | — | — |
| `kookbang:default:default` | 국방FM | 주파수 미확인 | — | — |
| `community:obn:default` | 옥천FM | 주파수 미확인 | — | — |

## 전북 (`jeonbuk`)

| 방송국 ID | 방송국 | FM MHz | 대표 지역 | 근거 |
|---|---|---|---|---|
| `kbs:1radio:jeonju` | KBS전주 1라디오 | 96.9 | 전주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:2radio:jeonju` | KBS전주 2라디오 | 92.9 | 전주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1fm:jeonju` | KBS전주 음악FM | 100.7 | 전주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `mbc:sfm:jeonju` | 전주MBC 표준FM | 101.7 | 전주 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:jeonju` | 전주MBC FM4U | 99.1 | 전주 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `sbs:powerfm:jeonju` | JTV 매직FM | 90.1 | 전주 | [공식 안내](https://www.sbs.co.kr/radio/frequency.html?div=gnb_program) |
| `ebs:fm:default` | EBS FM | 106.9 | 전주 | [공식 안내](https://www.ebs.co.kr/customer/introduce/watching/radiofrequency) |
| `ebs:bandi:default` | EBS 반디 외국어 전문 | 인터넷·기타 | — | — |
| `tbn:default:jeonbuk` | TBN 전북교통방송 | 102.5 | 전북 | [공식 안내](https://www.tbn.or.kr/) |
| `cbs:sfm:jeonbuk` | 전북CBS 표준FM | 103.7 | 전북 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:joy4u:default` | CBS JOY4U | 인터넷·기타 | — | — |
| `febc:default:jeonbuk` | FEBC 전북극동방송 | 91.1 | 전북 | [공식 안내](https://pohang.febc.net/intro/nationwide) |
| `wbs:default:jeonbuk` | WBS 전북원음방송 | 97.9 | 전북 | [공식 안내](https://wbsi.kr/) |
| `kookbang:default:default` | 국방FM | 주파수 미확인 | — | — |
| `afn:default:kunsan` | AFN FM Kunsan | 주파수 미확인 | — | — |
| `community:jcfm:default` | 전주FM | 주파수 미확인 | — | — |

## 제주 (`jeju`)

| 방송국 ID | 방송국 | FM MHz | 대표 지역 | 근거 |
|---|---|---|---|---|
| `kbs:1radio:jeju` | KBS제주 1라디오 | 99.1 | 제주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:2radio:jeju` | KBS제주 2라디오 | 91.9 | 제주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `kbs:1fm:jeju` | KBS제주 음악FM | 96.3 | 제주 | [공식 안내](https://radio.kbs.co.kr/frequency.html) |
| `mbc:sfm:jeju` | 제주MBC 표준FM | 97.9 | 제주 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `mbc:fm4u:jeju` | 제주MBC FM4U | 90.1 | 제주 | [공식 안내](https://www.imbc.com/broad/radio/frequency/) |
| `sbs:powerfm:jeju` | JIBS 뉴파워FM | 101.5 | 제주 | [공식 안내](https://www.sbs.co.kr/radio/frequency.html?div=gnb_program) |
| `ebs:fm:default` | EBS FM | 107.3 | 제주 | [공식 안내](https://www.ebs.co.kr/customer/introduce/watching/radiofrequency) |
| `ebs:bandi:default` | EBS 반디 외국어 전문 | 인터넷·기타 | — | — |
| `tbn:default:jeju` | TBN 제주교통방송 | 105.5 | 제주 | [공식 안내](https://www.tbn.or.kr/) |
| `cbs:sfm:jeju` | 제주CBS 표준FM | 93.3 | 제주 | [공식 안내](https://www2.cbs.co.kr/bangsong/) |
| `cbs:joy4u:default` | CBS JOY4U | 인터넷·기타 | — | — |
| `febc:default:jeju` | FEBC 제주극동방송 | 104.7 | 제주 | [공식 안내](https://pohang.febc.net/intro/nationwide) |
| `bbs:default:jeju` | BBS 제주불교방송 | 94.9 | 제주 | [공식 안내](https://www.bbsi.co.kr/HOME/about/about_channel.html?leftPos=channel) |
| `kookbang:default:default` | 국방FM | 94.1 | 서귀포 | [공식 안내](https://radio.dema.mil.kr/web/radio/inform/frequency.do) |
| `arirang:default:default` | Arirang Radio | 주파수 미확인 | — | — |


