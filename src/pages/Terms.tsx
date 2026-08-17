import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  alpha,
  Fade,
  Divider,
  useTheme,
} from '@mui/material';
import { Gavel, PrivacyTip } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSiteStore } from '@/stores/siteStore';



const agreementContent = {
  sections: [
    {
      title: '前置免责声明（开源项目重要说明）',
      content:
        '本文档为 XinBlog 开源博客系统配套通用用户协议模板，可供各位站长部署独立站点后自行修改、合规使用。本开源项目作者不参与任何第三方部署站点的日常运营，不对下游站点的内容纠纷、账号问题及合规事项承担责任。所有站点运营、用户管理、内容审核相关权责，均由当前站点的部署运营站长独立承担。',
    },
    {
      title: '一、服务概述',
      content:
        '本站基于 XinBlog 开源程序搭建，为广大用户提供免费的文章浏览、账号注册登录、内容点赞评论、留言墙互动等温馨的博客服务。本站所有服务均以当前实际状态提供，尽力为大家带来稳定、舒适的使用体验。',
    },
    {
      title: '二、账号注册与安全规则',
      items: [
        '您可根据自身需求自愿注册本站账号，注册过程仅需填写有效邮箱、自定义用户名及登录密码。',
        '本站会对您的登录密码进行哈希加密存储，全程不保存明文密码，最大程度守护您的账号安全。',
        '本站账号归属运营方所有，您仅可享有个人正常使用权限。请您妥善保管账号与密码，账号下的所有操作与行为均由本人负责。',
        '因个人疏忽、密码泄露、账号转借、设备异常等自身原因造成的账号问题或相关纠纷，将由您本人自行承担，本站不承担相关连带责任。',
        '本站目前暂未开放自助注销功能，若您需要注销账号、清空个人数据，可联系本站运营方协助办理。',
      ],
    },
    {
      title: '三、用户行为与内容规范',
      content:
        '为维护本站和谐、健康的交流氛围，大家在使用评论、点赞、留言墙等互动功能时，请自觉遵守规范，避免发布、传播以下内容：',
      items: [
        '违反国家法律法规、危害公共安全与社会公共利益的相关内容；',
        '侮辱、诽谤、骚扰他人，或侵犯他人肖像权、名誉权、隐私权等合法权益的内容；',
        '低俗暴力、宣扬不良风气、煽动对立、诱导违规违法的内容；',
        '广告引流、恶意灌水、刷屏重复内容、恶意攻击他人的不良信息；',
        '违背公序良俗、侵害第三方合法权益的各类内容。',
      ],
    },
    {
      title: '',
      content:
        '本站配备可自主开关的内容审核机制，站长可根据运营需求灵活设置：审核开启时所有用户评论、留言需审核通过方可公开展示；审核关闭时用户内容即时公开展示。无论审核功能开启或关闭，用户自主发布的内容均由发布者本人承担对应法律责任。为保障站点良好的交流环境，站长可自主对违规内容进行删除、屏蔽处理，对违规用户采取限制互动、封禁账号等管理措施。',
    },
    {
      title: '四、用户内容版权与授权',
      items: [
        '本站原创文章、页面设计、程序样式等内容，版权归本站运营方所有，未经许可请勿私自搬运、复刻及商用。',
        '您通过评论、留言墙发布的文字内容，著作权归您本人所有。',
        '您在本站发布内容后，即默认授予本站永久、免费、非独占的展示、存储与公开传播权限，仅用于站点正常功能运行与内容留存。',
        '对于违规、侵权、不良的内容，本站有权进行清理删除，以维护站点正常秩序。',
      ],
    },
    {
      title: '五、站点功能与权限说明',
      items: [
        '本站点赞、评论功能仅对登录用户开放，匿名访客暂不支持互动操作。',
        '留言墙支持双模式留言：登录用户可自主删除个人留言，匿名留言如需删除，可联系站长协助处理。',
        '本站仅开放头像个性化上传功能，无其他文件上传接口，建议您上传合规、健康、无侵权的头像素材。',
      ],
    },
    {
      title: '六、服务免责条款',
      items: [
        '本站为个人开源搭建的温馨博客站点，尽力为大家提供稳定的服务，但不承诺服务完全无故障、无中断。',
        '因网络波动、第三方服务异常、系统维护、不可抗力等因素造成的短暂服务异常，在法律允许范围内无需承担相关责任。',
        '所有用户在本站发布的言论与内容，仅代表个人观点，与本站及开源项目原作者无关。',
      ],
    },
    {
      title: '七、协议修订规则',
      content:
        '本站运营方可根据法律法规更新、站点功能迭代及日常运营需求，适时优化修订本协议。协议更新后将在本页面公示生效，不再单独逐一通知各位用户。',
    },
    {
      title: '八、适用法律与争议解决',
      content:
        '本协议受中华人民共和国法律管辖。若您与本站运营方在使用服务过程中产生分歧或纠纷，双方优先本着平等友好、诚信包容的原则协商沟通，友好化解问题；协商无法达成共识的，可通过网络行业常规调解渠道处理。',
    },
    {
      title: '九、联系我们',
      content: '如果您有账号咨询、内容申诉、协议疑问或数据处理相关需求，欢迎通过以下方式联系本站运营方：',
      items: [
        '【请部署者自行填写本站联系邮箱】',
        '【请部署者自行填写其他联系方式】',
      ],
    },
  ],
};

const privacyContent = {
  sections: [
    {
      title: '重要免责声明',
      content:
        '本政策仅为开源项目配套合规模板。所有独立部署站点的数据管理、内容审核、隐私合规及运营责任，均由当前站点部署运营站长独立全权承担，本开源项目原作者不承担任何连带运营、合规、纠纷责任。当您访问、浏览本站、注册账号并使用本站各项功能服务时，即代表您已充分知悉，并自愿认可、同意本隐私政策的全部条款。',
    },
    {
      title: '一、服务与适用说明',
      items: [
        '本站为基于 XinBlog 开源程序搭建的个人博客站点，对外提供文章浏览、用户注册登录、文章评论、点赞、公开留言墙交互服务。',
        '本隐私政策仅适用于当前独立部署的博客站点，与 XinBlog 项目官网、一键部署服务页面相互独立，各自政策互不适用。',
        '本站所有个人信息收集、处理、存储行为，均遵循合法、正当、必要、最小范围原则，仅为保障站点基础服务运行，不超范围采集用户隐私数据。',
      ],
    },
    {
      title: '二、用户信息收集范围与使用规则',
      content:
        '本站始终遵循隐私最小化原则，仅在您主动操作、或站点安全风控的必要场景下收集少量必需数据，不会在后台静默采集、私自窃取用户隐私信息。',
    },
    {
      title: '1. 账号注册信息',
      content: '如果您自愿注册本站账号，我们仅收集并存储以下几项基础必要信息，无多余采集内容：',
      items: [
        '自定义用户名',
        '注册邮箱（明文存储，用于账号核验、登录验证、消息通知）',
        '登录密码（仅采用哈希加密存储，不可逆解密，无明文留存）',
      ],
    },
    {
      title: '2. 文章评论、点赞数据',
      content:
        '本站的文章评论、点赞功能仅对登录注册用户开放，匿名访客暂时无法参与互动。每当您完成评论、点赞等互动操作后，系统会自动留存对应的关联数据，仅用于服务本站正常运转：保障前台内容正常展示、记录用户合法互动行为归属、方便站点日常内容管理与维护。所有互动数据均无商业用途，不会用于搭建用户画像、推送营销内容等无关行为。',
    },
    {
      title: '3. 留言墙交互数据',
      content: '本站留言墙贴心支持匿名留言、登录账号留言双模式，兼顾大家的使用便利与隐私需求：',
      items: [
        '登录用户留言：内容关联个人账号，用户享有自主删除本人留言的权利，可随时自行操作清理。',
        '匿名访客留言：无需注册登录、不绑定任何账号信息，发布后用户无自助删除权限，如需删除仅可联系本站站长处理。',
      ],
    },
    {
      title: '4. 安全风控被动数据',
      content:
        '当您进行评论、留言等前台互动操作时，系统会被动记录访问IP、设备及浏览器基础标识信息。这类数据仅用于站点安全防护，抵御恶意攻击、过滤垃圾灌水内容，不会对外公开、商用，也不会追踪您的日常浏览行为。',
    },
    {
      title: '三、内容审核机制（站长可自主开关）',
      content:
        '本站搭载了可自由开关的内容审核机制，审核权限完全由站点运营站长自主把控，灵活适配不同运营需求：审核开启时所有用户评论、留言内容需经站长审核通过方可对外公开展示；审核关闭时用户发布的评论、留言将实时直接展示。根据《网络数据安全管理条例》要求，站点内容合规治理、风险排查、违规内容处置责任，由本站运营站长全权承担。',
    },
    {
      title: '四、文件上传规则',
      content:
        '本站仅为登录用户提供头像自主上传的个性化功能，属于可选设置项。全站无其他多余文件上传接口，严格遵循最小权限原则，充分规避非必要的安全与隐私风险。',
    },
    {
      title: '五、Cookie 使用说明',
      content:
        '本站仅使用维持网站正常运行的功能性会话Cookie，只为稳定保留您的登录状态、保障页面交互流畅。全程无广告追踪、无第三方统计、无隐私采集脚本，不会记录您的浏览偏好。',
    },
    {
      title: '六、数据留存与存储规则',
      items: [
        '依据相关法律法规，本站用户数据的留存管理权限，由站点运营者自主把控。',
        '账号信息、评论、点赞、留言、头像等所有用户数据，暂无系统自动过期、自动销毁的机制。',
        '数据留存时长、内容清理与删除操作，均由站长根据日常运营需求自主处理。',
      ],
    },
    {
      title: '七、用户合法权利（依法公示）',
      content: '依据《中华人民共和国个人信息保护法》，每一位使用本站的用户，都享有以下合法个人权益：',
      items: [
        '知情权、查询权：用户有权知悉本站对个人信息的处理规则。',
        '更正权：用户可自主修改个人昵称、头像等公开展示信息。',
        '删除权：登录用户可自主删除本人发布的留言内容；匿名留言、其他数据可联系站长申请删除。',
        '限制处理权：用户有权拒绝非必要个人信息采集（本站无额外采集行为）。',
        '本站暂未开放自助账号注销功能，如需注销账号、清空全部个人数据，可联系本站运营方人工处理。',
      ],
    },
    {
      title: '八、第三方服务说明',
      content:
        '本站前台所有功能均为原生开发实现，用户的个人数据仅在本站系统内闭环处理，不会主动共享、上传或泄露给任何无关第三方平台。',
    },
    {
      title: '九、开源项目免责条款',
      items: [
        '本隐私政策为开源项目通用模板，仅作合规参考框架，由部署者自主修改适配。',
        '项目开源作者不参与、不监管、不负责任何第三方部署站点的运营与数据管理。',
        '任何个人部署站点产生的隐私纠纷、数据泄露、内容违规、合规处罚等全部责任，均由该站点运营方独立承担。',
      ],
    },
    {
      title: '十、政策更新机制',
      content:
        '站点运营方可根据法律法规更新、站点功能迭代，适时修订本政策。政策更新后将直接在本页面公示生效，不再单独通知每一位用户。',
    },
    {
      title: '十一、联系我们',
      content: '如果您有个人信息查询、更正、删除相关的疑问或诉求，欢迎通过以下方式联系本站运营方：',
      items: [
        '【请部署者自行填写本站联系邮箱】',
        '【请部署者自行填写其他联系方式】',
      ],
    },
  ],
};

function SectionContent({
  section,
  index,
}: {
  section: (typeof agreementContent.sections)[number];
  index: number;
}) {
  return (
    <Box sx={{ mb: index === 0 ? 0 : 3.5 }}>
      {section.title && (
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            mb: 1.5,
            mt: index === 0 ? 0 : 0.5,
            color: 'text.primary',
            fontSize: { xs: '1rem', sm: '1.1rem' },
          }}
        >
          {section.title}
        </Typography>
      )}
      {section.content && (
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{
            lineHeight: 1.9,
            mb: section.items ? 1.5 : 0,
            fontSize: { xs: '0.875rem', sm: '0.95rem' },
          }}
        >
          {section.content}
        </Typography>
      )}
      {section.items && (
        <Box component="ul" sx={{ m: 0, pl: { xs: 2.5, sm: 3 }, '& li': { mb: 1 } }}>
          {section.items.map((item, i) => (
            <Typography
              key={i}
              component="li"
              variant="body1"
              color="text.secondary"
              sx={{
                lineHeight: 1.9,
                fontSize: { xs: '0.875rem', sm: '0.95rem' },
                '&::marker': {
                  color: (theme) => alpha(theme.palette.primary.main, 0.5),
                },
              }}
            >
              {item}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function Terms() {
  const theme = useTheme();
  const location = useLocation();
  const site = useSiteStore();
  const isAgreement = location.pathname === '/agreement';

  
  const customContent = isAgreement
    ? site.config.termsAgreement ?? ''
    : site.config.termsPrivacy ?? '';

  const hasCustomContent = customContent.trim().length > 0;

  const { title, icon: Icon, updateDate, sections } = useMemo(
    () => ({
      title: isAgreement ? '用户协议' : '隐私政策',
      icon: isAgreement ? Gavel : PrivacyTip,
      updateDate: '2026 年 08 月 15 日',
      sections: isAgreement ? agreementContent.sections : privacyContent.sections,
    }),
    [isAgreement],
  );

  return (
    <Fade in timeout={400}>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 }, pb: { xs: 8, md: 12 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 4, md: 6 },
            borderRadius: 1,
            background: (t) =>
              `linear-gradient(135deg, ${t.palette.background.paper} 0%, ${t.palette.background.default} 100%)`,
            boxShadow: (t) =>
              t.palette.mode === 'light'
                ? `0 8px 40px ${alpha(theme.palette.primary.main, 0.1)}`
                : `0 8px 40px ${alpha(theme.palette.common.black, 0.3)}`,
          }}
        >
          {/* 头部图标 + 标题 */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: { xs: 56, sm: 72 },
                height: { xs: 56, sm: 72 },
                borderRadius: '50%',
                mb: 2,
                background: (t) => t.palette.gradient.primary,
                color: '#fff',
              }}
            >
              <Icon sx={{ fontSize: { xs: 28, sm: 36 } }} />
            </Box>
            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' },
                background: (t) => t.palette.gradient.primary,
                backgroundClip: 'text',
                textFillColor: 'transparent',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
              }}
            >
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              更新日期：{updateDate}
            </Typography>
          </Box>

          <Divider sx={{ mb: 4 }} />

          {/* 协议 / 政策正文 */}
          <Box sx={{ maxWidth: 720, mx: 'auto' }}>
            {/* 前置声明 - 仅协议有 */}
            {isAgreement && (
              <Box
                sx={{
                  p: { xs: 2, sm: 3 },
                  mb: 4,
                  borderRadius: 1,
                  bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.06 : 0.12),
                  border: 1,
                  borderColor: (t) => alpha(t.palette.primary.main, 0.15),
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ lineHeight: 1.9, fontSize: { xs: '0.825rem', sm: '0.9rem' } }}
                >
                  您访问、注册、登录并使用本站相关服务，即代表您已认真阅读、充分理解，并自愿遵守本协议的全部约定。
                </Typography>
              </Box>
            )}

            {/* 隐私政策声明 */}
            {!isAgreement && (
              <Box
                sx={{
                  p: { xs: 2, sm: 3 },
                  mb: 4,
                  borderRadius: 1,
                  bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.06 : 0.12),
                  border: 1,
                  borderColor: (t) => alpha(t.palette.primary.main, 0.15),
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ lineHeight: 1.9, fontSize: { xs: '0.825rem', sm: '0.9rem' } }}
                >
                  本站遵循《中华人民共和国个人信息保护法》《网络数据安全管理条例》合规要求，清晰、透明地向大家公示本站的个人信息处理规则。
                </Typography>
              </Box>
            )}

            {/* 正文：自定义内容 → Markdown 渲染；无自定义内容 → 硬编码兜底 */}
            {hasCustomContent ? (
              <Box
                className="terms-markdown"
                sx={{
                  color: 'text.primary',
                  lineHeight: 1.8,
                  fontSize: { xs: '0.95rem', md: '1rem' },
                  '& h1, & h2, & h3, & h4, & h5, & h6': {
                    mt: 4,
                    mb: 2,
                    fontWeight: 700,
                    color: 'text.primary',
                    overflowWrap: 'break-word',
                  },
                  '& h1': { fontSize: { xs: '1.5rem', md: '1.75rem' } },
                  '& h2': { fontSize: { xs: '1.25rem', md: '1.45rem' } },
                  '& h3': { fontSize: { xs: '1.125rem', md: '1.25rem' } },
                  '& p': {
                    mb: 2,
                    overflowWrap: 'break-word',
                    whiteSpace: 'pre-wrap',
                    color: 'text.secondary',
                  },
                  '& ul, & ol': {
                    pl: 3,
                    mb: 2,
                    color: 'text.secondary',
                  },
                  '& li': {
                    mb: 0.75,
                    overflowWrap: 'break-word',
                    lineHeight: 1.9,
                  },
                  '& a': {
                    color: 'primary.main',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                  },
                  '& strong': { fontWeight: 700, color: 'text.primary' },
                  '& hr': {
                    border: 'none',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    my: 4,
                  },
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {customContent}
                </ReactMarkdown>
              </Box>
            ) : (
              sections.map((section, index) => (
                <SectionContent key={index} section={section} index={index} />
              ))
            )}
          </Box>
        </Paper>
      </Container>
    </Fade>
  );
}