import type { DefineSchema, EnumType, Field, Input, InputObjectType, ObjectType, ScalarType, UnionType } from 'gazania'

type Scalar_Json = ScalarType<'Json', unknown, unknown>
type Scalar_CountryCode = ScalarType<'CountryCode', unknown, unknown>
type Scalar_FuzzyDateInt = ScalarType<'FuzzyDateInt', unknown, unknown>
type Scalar_Int = ScalarType<'Int', number, number>
type Scalar_Float = ScalarType<'Float', number, number>
type Scalar_String = ScalarType<'String', string, string>
type Scalar_Boolean = ScalarType<'Boolean', boolean, boolean>
type Scalar_ID = ScalarType<'ID', string, string | number>

/** User sort enums */
export type UserSort
  = | 'ID'
    | 'ID_DESC'
    | 'USERNAME'
    | 'USERNAME_DESC'
    | 'WATCHED_TIME'
    | 'WATCHED_TIME_DESC'
    | 'CHAPTERS_READ'
    | 'CHAPTERS_READ_DESC'
    | 'SEARCH_MATCH'
type Enum_UserSort = EnumType<'UserSort', UserSort>

/** The language the user wants to see media titles in */
export type UserTitleLanguage
  /** The romanization of the native language title */
  = | 'ROMAJI'
  /** The official english title */
    | 'ENGLISH'
  /** Official title in it's native language */
    | 'NATIVE'
  /** The romanization of the native language title, stylised by media creator */
    | 'ROMAJI_STYLISED'
  /** The official english title, stylised by media creator */
    | 'ENGLISH_STYLISED'
  /** Official title in it's native language, stylised by media creator */
    | 'NATIVE_STYLISED'
type Enum_UserTitleLanguage = EnumType<'UserTitleLanguage', UserTitleLanguage>

/** Notification type enum */
export type NotificationType
  /** A user has sent you message */
  = | 'ACTIVITY_MESSAGE'
  /** A user has replied to your activity */
    | 'ACTIVITY_REPLY'
  /** A user has followed you */
    | 'FOLLOWING'
  /** A user has mentioned you in their activity */
    | 'ACTIVITY_MENTION'
  /** A user has mentioned you in a forum comment */
    | 'THREAD_COMMENT_MENTION'
  /** A user has commented in one of your subscribed forum threads */
    | 'THREAD_SUBSCRIBED'
  /** A user has replied to your forum comment */
    | 'THREAD_COMMENT_REPLY'
  /** An anime you are currently watching has aired */
    | 'AIRING'
  /** A user has liked your activity */
    | 'ACTIVITY_LIKE'
  /** A user has liked your activity reply */
    | 'ACTIVITY_REPLY_LIKE'
  /** A user has liked your forum thread */
    | 'THREAD_LIKE'
  /** A user has liked your forum comment */
    | 'THREAD_COMMENT_LIKE'
  /** A user has replied to activity you have also replied to */
    | 'ACTIVITY_REPLY_SUBSCRIBED'
  /** A new anime or manga has been added to the site where its related media is on the user's list */
    | 'RELATED_MEDIA_ADDITION'
  /** An anime or manga has had a data change that affects how a user may track it in their lists */
    | 'MEDIA_DATA_CHANGE'
  /** Anime or manga entries on the user's list have been merged into a single entry */
    | 'MEDIA_MERGE'
  /** An anime or manga on the user's list has been deleted from the site */
    | 'MEDIA_DELETION'
  /** A user's submission has been accepted, partially accepted, or rejected */
    | 'MEDIA_SUBMISSION_UPDATE'
  /** A user's staff submission has been accepted, partially accepted, or rejected */
    | 'STAFF_SUBMISSION_UPDATE'
  /** A user's character submission has been accepted, partially accepted, or rejected */
    | 'CHARACTER_SUBMISSION_UPDATE'
type Enum_NotificationType = EnumType<'NotificationType', NotificationType>

/** The language the user wants to see staff and character names in */
export type UserStaffNameLanguage
  /** The romanization of the staff or character's native name, with western name ordering */
  = | 'ROMAJI_WESTERN'
  /** The romanization of the staff or character's native name */
    | 'ROMAJI'
  /** The staff or character's name in their native language */
    | 'NATIVE'
type Enum_UserStaffNameLanguage = EnumType<'UserStaffNameLanguage', UserStaffNameLanguage>

/** Media list watching/reading status enum. */
export type MediaListStatus
  /** Currently watching/reading */
  = | 'CURRENT'
  /** Planning to watch/read */
    | 'PLANNING'
  /** Finished watching/reading */
    | 'COMPLETED'
  /** Stopped watching/reading before completing */
    | 'DROPPED'
  /** Paused watching/reading */
    | 'PAUSED'
  /** Re-watching/reading */
    | 'REPEATING'
type Enum_MediaListStatus = EnumType<'MediaListStatus', MediaListStatus>

/** Media list scoring type */
export type ScoreFormat
  /** An integer from 0-100 */
  = | 'POINT_100'
  /** A float from 0-10 with 1 decimal place */
    | 'POINT_10_DECIMAL'
  /** An integer from 0-10 */
    | 'POINT_10'
  /** An integer from 0-5. Should be represented in Stars */
    | 'POINT_5'
  /** An integer from 0-3. Should be represented in Smileys. 0 => No Score, 1 => :(, 2 => :|, 3 => :) */
    | 'POINT_3'
type Enum_ScoreFormat = EnumType<'ScoreFormat', ScoreFormat>

/** Media type enum, anime or manga. */
export type MediaType
  /** Japanese Anime */
  = | 'ANIME'
  /** Asian comic */
    | 'MANGA'
type Enum_MediaType = EnumType<'MediaType', MediaType>

/** The format the media was released in */
export type MediaFormat
  /** Anime broadcast on television */
  = | 'TV'
  /** Anime which are under 15 minutes in length and broadcast on television */
    | 'TV_SHORT'
  /** Anime movies with a theatrical release */
    | 'MOVIE'
  /** Special episodes that have been included in DVD/Blu-ray releases, picture dramas, pilots, etc */
    | 'SPECIAL'
  /** (Original Video Animation) Anime that have been released directly on DVD/Blu-ray without originally going through a theatrical release or television broadcast */
    | 'OVA'
  /** (Original Net Animation) Anime that have been originally released online or are only available through streaming services. */
    | 'ONA'
  /** Short anime released as a music video */
    | 'MUSIC'
  /** Professionally published manga with more than one chapter */
    | 'MANGA'
  /** Written books released as a series of light novels */
    | 'NOVEL'
  /** Manga with just one chapter */
    | 'ONE_SHOT'
type Enum_MediaFormat = EnumType<'MediaFormat', MediaFormat>

/** The current releasing status of the media */
export type MediaStatus
  /** Has completed and is no longer being released */
  = | 'FINISHED'
  /** Currently releasing */
    | 'RELEASING'
  /** To be released at a later date */
    | 'NOT_YET_RELEASED'
  /** Ended before the work could be finished */
    | 'CANCELLED'
  /** Version 2 only. Is currently paused from releasing and will resume at a later date */
    | 'HIATUS'
type Enum_MediaStatus = EnumType<'MediaStatus', MediaStatus>

export type MediaSeason
  /** Predominantly started airing between January and March */
  = | 'WINTER'
  /** Predominantly started airing between April and June */
    | 'SPRING'
  /** Predominantly started airing between July and September */
    | 'SUMMER'
  /** Predominantly started airing between October and November */
    | 'FALL'
type Enum_MediaSeason = EnumType<'MediaSeason', MediaSeason>

/** Source type the media was adapted from */
export type MediaSource
  /** An original production not based of another work */
  = | 'ORIGINAL'
  /** Asian comic book */
    | 'MANGA'
  /** Written work published in volumes */
    | 'LIGHT_NOVEL'
  /** Video game driven primary by text and narrative */
    | 'VISUAL_NOVEL'
  /** Video game */
    | 'VIDEO_GAME'
  /** Other */
    | 'OTHER'
  /** Version 2+ only. Written works not published in volumes */
    | 'NOVEL'
  /** Version 2+ only. Self-published works */
    | 'DOUJINSHI'
  /** Version 2+ only. Japanese Anime */
    | 'ANIME'
  /** Version 3 only. Written works published online */
    | 'WEB_NOVEL'
  /** Version 3 only. Live action media such as movies or TV show */
    | 'LIVE_ACTION'
  /** Version 3 only. Games excluding video games */
    | 'GAME'
  /** Version 3 only. Comics excluding manga */
    | 'COMIC'
  /** Version 3 only. Multimedia project */
    | 'MULTIMEDIA_PROJECT'
  /** Version 3 only. Picture book */
    | 'PICTURE_BOOK'
type Enum_MediaSource = EnumType<'MediaSource', MediaSource>

/** Character sort enums */
export type CharacterSort
  = | 'ID'
    | 'ID_DESC'
    | 'ROLE'
    | 'ROLE_DESC'
    | 'SEARCH_MATCH'
    | 'FAVOURITES'
    | 'FAVOURITES_DESC'
  /** Order manually decided by moderators */
    | 'RELEVANCE'
type Enum_CharacterSort = EnumType<'CharacterSort', CharacterSort>

/** The role the character plays in the media */
export type CharacterRole
  /** A primary character role in the media */
  = | 'MAIN'
  /** A supporting character role in the media */
    | 'SUPPORTING'
  /** A background character in the media */
    | 'BACKGROUND'
type Enum_CharacterRole = EnumType<'CharacterRole', CharacterRole>

/** Media sort enums */
export type MediaSort
  = | 'ID'
    | 'ID_DESC'
    | 'TITLE_ROMAJI'
    | 'TITLE_ROMAJI_DESC'
    | 'TITLE_ENGLISH'
    | 'TITLE_ENGLISH_DESC'
    | 'TITLE_NATIVE'
    | 'TITLE_NATIVE_DESC'
    | 'TYPE'
    | 'TYPE_DESC'
    | 'FORMAT'
    | 'FORMAT_DESC'
    | 'START_DATE'
    | 'START_DATE_DESC'
    | 'END_DATE'
    | 'END_DATE_DESC'
    | 'SCORE'
    | 'SCORE_DESC'
    | 'POPULARITY'
    | 'POPULARITY_DESC'
    | 'TRENDING'
    | 'TRENDING_DESC'
    | 'EPISODES'
    | 'EPISODES_DESC'
    | 'DURATION'
    | 'DURATION_DESC'
    | 'STATUS'
    | 'STATUS_DESC'
    | 'CHAPTERS'
    | 'CHAPTERS_DESC'
    | 'VOLUMES'
    | 'VOLUMES_DESC'
    | 'UPDATED_AT'
    | 'UPDATED_AT_DESC'
    | 'SEARCH_MATCH'
    | 'FAVOURITES'
    | 'FAVOURITES_DESC'
type Enum_MediaSort = EnumType<'MediaSort', MediaSort>

/** The primary language of the voice actor */
export type StaffLanguage
  /** Japanese */
  = | 'JAPANESE'
  /** English */
    | 'ENGLISH'
  /** Korean */
    | 'KOREAN'
  /** Italian */
    | 'ITALIAN'
  /** Spanish */
    | 'SPANISH'
  /** Portuguese */
    | 'PORTUGUESE'
  /** French */
    | 'FRENCH'
  /** German */
    | 'GERMAN'
  /** Hebrew */
    | 'HEBREW'
  /** Hungarian */
    | 'HUNGARIAN'
type Enum_StaffLanguage = EnumType<'StaffLanguage', StaffLanguage>

/** Staff sort enums */
export type StaffSort
  = | 'ID'
    | 'ID_DESC'
    | 'ROLE'
    | 'ROLE_DESC'
    | 'LANGUAGE'
    | 'LANGUAGE_DESC'
    | 'SEARCH_MATCH'
    | 'FAVOURITES'
    | 'FAVOURITES_DESC'
  /** Order manually decided by moderators */
    | 'RELEVANCE'
type Enum_StaffSort = EnumType<'StaffSort', StaffSort>

/** Studio sort enums */
export type StudioSort
  = | 'ID'
    | 'ID_DESC'
    | 'NAME'
    | 'NAME_DESC'
    | 'SEARCH_MATCH'
    | 'FAVOURITES'
    | 'FAVOURITES_DESC'
type Enum_StudioSort = EnumType<'StudioSort', StudioSort>

/** Media trend sort enums */
export type MediaTrendSort
  = | 'ID'
    | 'ID_DESC'
    | 'MEDIA_ID'
    | 'MEDIA_ID_DESC'
    | 'DATE'
    | 'DATE_DESC'
    | 'SCORE'
    | 'SCORE_DESC'
    | 'POPULARITY'
    | 'POPULARITY_DESC'
    | 'TRENDING'
    | 'TRENDING_DESC'
    | 'EPISODE'
    | 'EPISODE_DESC'
type Enum_MediaTrendSort = EnumType<'MediaTrendSort', MediaTrendSort>

export type ExternalLinkType
  = | 'INFO'
    | 'STREAMING'
    | 'SOCIAL'
type Enum_ExternalLinkType = EnumType<'ExternalLinkType', ExternalLinkType>

/** The type of ranking */
export type MediaRankType
  /** Ranking is based on the media's ratings/score */
  = | 'RATED'
  /** Ranking is based on the media's popularity */
    | 'POPULAR'
type Enum_MediaRankType = EnumType<'MediaRankType', MediaRankType>

/** Review sort enums */
export type ReviewSort
  = | 'ID'
    | 'ID_DESC'
    | 'SCORE'
    | 'SCORE_DESC'
    | 'RATING'
    | 'RATING_DESC'
  /** @deprecated Use ID instead */
    | 'CREATED_AT'
  /** @deprecated Use ID_DESC instead */
    | 'CREATED_AT_DESC'
    | 'UPDATED_AT'
    | 'UPDATED_AT_DESC'
type Enum_ReviewSort = EnumType<'ReviewSort', ReviewSort>

/** Review rating enums */
export type ReviewRating
  = | 'NO_VOTE'
    | 'UP_VOTE'
    | 'DOWN_VOTE'
type Enum_ReviewRating = EnumType<'ReviewRating', ReviewRating>

/** Recommendation sort enums */
export type RecommendationSort
  = | 'ID'
    | 'ID_DESC'
    | 'RATING'
    | 'RATING_DESC'
type Enum_RecommendationSort = EnumType<'RecommendationSort', RecommendationSort>

/** Recommendation rating enums */
export type RecommendationRating
  = | 'NO_RATING'
    | 'RATE_UP'
    | 'RATE_DOWN'
type Enum_RecommendationRating = EnumType<'RecommendationRating', RecommendationRating>

/** Type of relation media has to its parent. */
export type MediaRelation
  /** An adaption of this media into a different format */
  = | 'ADAPTATION'
  /** Released before the relation */
    | 'PREQUEL'
  /** Released after the relation */
    | 'SEQUEL'
  /** The media a side story is from */
    | 'PARENT'
  /** A side story of the parent media */
    | 'SIDE_STORY'
  /** Shares at least 1 character */
    | 'CHARACTER'
  /** A shortened and summarized version */
    | 'SUMMARY'
  /** An alternative version of the same media */
    | 'ALTERNATIVE'
  /** An alternative version of the media with a different primary focus */
    | 'SPIN_OFF'
  /** Other */
    | 'OTHER'
  /** Version 2 only. The source material the media was adapted from */
    | 'SOURCE'
  /** Version 2 only. */
    | 'COMPILATION'
  /** Version 2 only. */
    | 'CONTAINS'
type Enum_MediaRelation = EnumType<'MediaRelation', MediaRelation>

/** User statistics sort enum */
export type UserStatisticsSort
  = | 'ID'
    | 'ID_DESC'
    | 'COUNT'
    | 'COUNT_DESC'
    | 'PROGRESS'
    | 'PROGRESS_DESC'
    | 'MEAN_SCORE'
    | 'MEAN_SCORE_DESC'
type Enum_UserStatisticsSort = EnumType<'UserStatisticsSort', UserStatisticsSort>

/** Mod role enums */
export type ModRole
  /** An AniList administrator */
  = | 'ADMIN'
  /** A head developer of AniList */
    | 'LEAD_DEVELOPER'
  /** An AniList developer */
    | 'DEVELOPER'
  /** A lead community moderator */
    | 'LEAD_COMMUNITY'
  /** A community moderator */
    | 'COMMUNITY'
  /** A discord community moderator */
    | 'DISCORD_COMMUNITY'
  /** A lead anime data moderator */
    | 'LEAD_ANIME_DATA'
  /** An anime data moderator */
    | 'ANIME_DATA'
  /** A lead manga data moderator */
    | 'LEAD_MANGA_DATA'
  /** A manga data moderator */
    | 'MANGA_DATA'
  /** A lead social media moderator */
    | 'LEAD_SOCIAL_MEDIA'
  /** A social media moderator */
    | 'SOCIAL_MEDIA'
  /** A retired moderator */
    | 'RETIRED'
  /** A character data moderator */
    | 'CHARACTER_DATA'
  /** A staff data moderator */
    | 'STAFF_DATA'
type Enum_ModRole = EnumType<'ModRole', ModRole>

/** Media list sort enums */
export type MediaListSort
  = | 'MEDIA_ID'
    | 'MEDIA_ID_DESC'
    | 'SCORE'
    | 'SCORE_DESC'
    | 'STATUS'
    | 'STATUS_DESC'
    | 'PROGRESS'
    | 'PROGRESS_DESC'
    | 'PROGRESS_VOLUMES'
    | 'PROGRESS_VOLUMES_DESC'
    | 'REPEAT'
    | 'REPEAT_DESC'
    | 'PRIORITY'
    | 'PRIORITY_DESC'
    | 'STARTED_ON'
    | 'STARTED_ON_DESC'
    | 'FINISHED_ON'
    | 'FINISHED_ON_DESC'
    | 'ADDED_TIME'
    | 'ADDED_TIME_DESC'
    | 'UPDATED_TIME'
    | 'UPDATED_TIME_DESC'
    | 'MEDIA_TITLE_ROMAJI'
    | 'MEDIA_TITLE_ROMAJI_DESC'
    | 'MEDIA_TITLE_ENGLISH'
    | 'MEDIA_TITLE_ENGLISH_DESC'
    | 'MEDIA_TITLE_NATIVE'
    | 'MEDIA_TITLE_NATIVE_DESC'
    | 'MEDIA_POPULARITY'
    | 'MEDIA_POPULARITY_DESC'
type Enum_MediaListSort = EnumType<'MediaListSort', MediaListSort>

/** Airing schedule sort enums */
export type AiringSort
  = | 'ID'
    | 'ID_DESC'
    | 'MEDIA_ID'
    | 'MEDIA_ID_DESC'
    | 'TIME'
    | 'TIME_DESC'
    | 'EPISODE'
    | 'EPISODE_DESC'
type Enum_AiringSort = EnumType<'AiringSort', AiringSort>

/** Activity type enum. */
export type ActivityType
  /** A text activity */
  = | 'TEXT'
  /** A anime list update activity */
    | 'ANIME_LIST'
  /** A manga list update activity */
    | 'MANGA_LIST'
  /** A text message activity sent to another user */
    | 'MESSAGE'
  /** Anime & Manga list update, only used in query arguments */
    | 'MEDIA_LIST'
type Enum_ActivityType = EnumType<'ActivityType', ActivityType>

/** Activity sort enums */
export type ActivitySort
  = | 'ID'
    | 'ID_DESC'
    | 'PINNED'
type Enum_ActivitySort = EnumType<'ActivitySort', ActivitySort>

/** Thread sort enums */
export type ThreadSort
  = | 'ID'
    | 'ID_DESC'
    | 'TITLE'
    | 'TITLE_DESC'
  /** @deprecated Use ID instead */
    | 'CREATED_AT'
  /** @deprecated Use ID_DESC instead */
    | 'CREATED_AT_DESC'
    | 'UPDATED_AT'
    | 'UPDATED_AT_DESC'
    | 'REPLIED_AT'
    | 'REPLIED_AT_DESC'
    | 'REPLY_COUNT'
    | 'REPLY_COUNT_DESC'
    | 'VIEW_COUNT'
    | 'VIEW_COUNT_DESC'
    | 'IS_STICKY'
    | 'SEARCH_MATCH'
type Enum_ThreadSort = EnumType<'ThreadSort', ThreadSort>

/** Thread comments sort enums */
export type ThreadCommentSort
  = | 'ID'
    | 'ID_DESC'
type Enum_ThreadCommentSort = EnumType<'ThreadCommentSort', ThreadCommentSort>

/** Types that can be liked */
export type LikeableType
  = | 'THREAD'
    | 'THREAD_COMMENT'
    | 'ACTIVITY'
    | 'ACTIVITY_REPLY'
type Enum_LikeableType = EnumType<'LikeableType', LikeableType>

/** Site trend sort enums */
export type SiteTrendSort
  = | 'DATE'
    | 'DATE_DESC'
    | 'COUNT'
    | 'COUNT_DESC'
    | 'CHANGE'
    | 'CHANGE_DESC'
type Enum_SiteTrendSort = EnumType<'SiteTrendSort', SiteTrendSort>

export type ExternalLinkMediaType
  = | 'ANIME'
    | 'MANGA'
    | 'STAFF'
type Enum_ExternalLinkMediaType = EnumType<'ExternalLinkMediaType', ExternalLinkMediaType>

/** Submission status */
export type SubmissionStatus
  = | 'PENDING'
    | 'REJECTED'
    | 'PARTIALLY_ACCEPTED'
    | 'ACCEPTED'
type Enum_SubmissionStatus = EnumType<'SubmissionStatus', SubmissionStatus>

/** Submission sort enums */
export type SubmissionSort
  = | 'ID'
    | 'ID_DESC'
type Enum_SubmissionSort = EnumType<'SubmissionSort', SubmissionSort>

/** Revision history actions */
export type RevisionHistoryAction
  = | 'CREATE'
    | 'EDIT'
type Enum_RevisionHistoryAction = EnumType<'RevisionHistoryAction', RevisionHistoryAction>

export type ModActionType
  = | 'NOTE'
    | 'BAN'
    | 'DELETE'
    | 'EDIT'
    | 'EXPIRE'
    | 'REPORT'
    | 'RESET'
    | 'ANON'
type Enum_ModActionType = EnumType<'ModActionType', ModActionType>

/** Notification option input */
type Input_NotificationOptionInput = InputObjectType<'NotificationOptionInput', {
  /** The type of notification */
  type: Input<Enum_NotificationType | null>
  /** Whether this type of notification is enabled */
  enabled: Input<Scalar_Boolean | null>
}>

/** A user's list options for anime or manga lists */
type Input_MediaListOptionsInput = InputObjectType<'MediaListOptionsInput', {
  /** The order each list should be displayed in */
  sectionOrder: Input<(Scalar_String | null)[] | null>
  /** If the completed sections of the list should be separated by format */
  splitCompletedSectionByFormat: Input<Scalar_Boolean | null>
  /** The names of the user's custom lists */
  customLists: Input<(Scalar_String | null)[] | null>
  /** The names of the user's advanced scoring sections */
  advancedScoring: Input<(Scalar_String | null)[] | null>
  /** If advanced scoring is enabled */
  advancedScoringEnabled: Input<Scalar_Boolean | null>
  /** list theme */
  theme: Input<Scalar_String | null>
}>

type Input_ListActivityOptionInput = InputObjectType<'ListActivityOptionInput', {
  disabled: Input<Scalar_Boolean | null>
  type: Input<Enum_MediaListStatus | null>
}>

/** Date object that allows for incomplete date values (fuzzy) */
type Input_FuzzyDateInput = InputObjectType<'FuzzyDateInput', {
  /** Numeric Year (2017) */
  year: Input<Scalar_Int | null>
  /** Numeric Month (3) */
  month: Input<Scalar_Int | null>
  /** Numeric Day (24) */
  day: Input<Scalar_Int | null>
}>

type Input_AniChartHighlightInput = InputObjectType<'AniChartHighlightInput', {
  mediaId: Input<Scalar_Int | null>
  highlight: Input<Scalar_String | null>
}>

/** The official titles of the media in various languages */
type Input_MediaTitleInput = InputObjectType<'MediaTitleInput', {
  /** The romanization of the native language title */
  romaji: Input<Scalar_String | null>
  /** The official english title */
  english: Input<Scalar_String | null>
  /** Official title in it's native language */
  native: Input<Scalar_String | null>
}>

type Input_AiringScheduleInput = InputObjectType<'AiringScheduleInput', {
  airingAt: Input<Scalar_Int | null>
  episode: Input<Scalar_Int | null>
  timeUntilAiring: Input<Scalar_Int | null>
}>

/** An external link to another site related to the media */
type Input_MediaExternalLinkInput = InputObjectType<'MediaExternalLinkInput', {
  /** The id of the external link */
  id: Input<Scalar_Int>
  /** The url of the external link */
  url: Input<Scalar_String>
  /** The site location of the external link */
  site: Input<Scalar_String>
}>

/** The names of the character */
type Input_CharacterNameInput = InputObjectType<'CharacterNameInput', {
  /** The character's given name */
  first: Input<Scalar_String | null>
  /** The character's middle name */
  middle: Input<Scalar_String | null>
  /** The character's surname */
  last: Input<Scalar_String | null>
  /** The character's full name in their native language */
  native: Input<Scalar_String | null>
  /** Other names the character might be referred by */
  alternative: Input<(Scalar_String | null)[] | null>
  /** Other names the character might be referred to as but are spoilers */
  alternativeSpoiler: Input<(Scalar_String | null)[] | null>
}>

/** The names of the staff member */
type Input_StaffNameInput = InputObjectType<'StaffNameInput', {
  /** The person's given name */
  first: Input<Scalar_String | null>
  /** The person's middle name */
  middle: Input<Scalar_String | null>
  /** The person's surname */
  last: Input<Scalar_String | null>
  /** The person's full name in their native language */
  native: Input<Scalar_String | null>
  /** Other names the character might be referred by */
  alternative: Input<(Scalar_String | null)[] | null>
}>

type Type_Query = ObjectType<'Query', {
  Page: Field<Type_Page | null, {
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** Media query */
  Media: Field<Type_Media | null, {
    id: Input<Scalar_Int | null>
    idMal: Input<Scalar_Int | null>
    startDate: Input<Scalar_FuzzyDateInt | null>
    endDate: Input<Scalar_FuzzyDateInt | null>
    season: Input<Enum_MediaSeason | null>
    seasonYear: Input<Scalar_Int | null>
    type: Input<Enum_MediaType | null>
    format: Input<Enum_MediaFormat | null>
    status: Input<Enum_MediaStatus | null>
    episodes: Input<Scalar_Int | null>
    duration: Input<Scalar_Int | null>
    chapters: Input<Scalar_Int | null>
    volumes: Input<Scalar_Int | null>
    isAdult: Input<Scalar_Boolean | null>
    genre: Input<Scalar_String | null>
    tag: Input<Scalar_String | null>
    minimumTagRank: Input<Scalar_Int | null>
    tagCategory: Input<Scalar_String | null>
    onList: Input<Scalar_Boolean | null>
    licensedBy: Input<Scalar_String | null>
    licensedById: Input<Scalar_Int | null>
    averageScore: Input<Scalar_Int | null>
    popularity: Input<Scalar_Int | null>
    source: Input<Enum_MediaSource | null>
    countryOfOrigin: Input<Scalar_CountryCode | null>
    isLicensed: Input<Scalar_Boolean | null>
    search: Input<Scalar_String | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    idMal_not: Input<Scalar_Int | null>
    idMal_in: Input<(Scalar_Int | null)[] | null>
    idMal_not_in: Input<(Scalar_Int | null)[] | null>
    startDate_greater: Input<Scalar_FuzzyDateInt | null>
    startDate_lesser: Input<Scalar_FuzzyDateInt | null>
    startDate_like: Input<Scalar_String | null>
    endDate_greater: Input<Scalar_FuzzyDateInt | null>
    endDate_lesser: Input<Scalar_FuzzyDateInt | null>
    endDate_like: Input<Scalar_String | null>
    format_in: Input<(Enum_MediaFormat | null)[] | null>
    format_not: Input<Enum_MediaFormat | null>
    format_not_in: Input<(Enum_MediaFormat | null)[] | null>
    status_in: Input<(Enum_MediaStatus | null)[] | null>
    status_not: Input<Enum_MediaStatus | null>
    status_not_in: Input<(Enum_MediaStatus | null)[] | null>
    episodes_greater: Input<Scalar_Int | null>
    episodes_lesser: Input<Scalar_Int | null>
    duration_greater: Input<Scalar_Int | null>
    duration_lesser: Input<Scalar_Int | null>
    chapters_greater: Input<Scalar_Int | null>
    chapters_lesser: Input<Scalar_Int | null>
    volumes_greater: Input<Scalar_Int | null>
    volumes_lesser: Input<Scalar_Int | null>
    genre_in: Input<(Scalar_String | null)[] | null>
    genre_not_in: Input<(Scalar_String | null)[] | null>
    tag_in: Input<(Scalar_String | null)[] | null>
    tag_not_in: Input<(Scalar_String | null)[] | null>
    tagCategory_in: Input<(Scalar_String | null)[] | null>
    tagCategory_not_in: Input<(Scalar_String | null)[] | null>
    licensedBy_in: Input<(Scalar_String | null)[] | null>
    licensedById_in: Input<(Scalar_Int | null)[] | null>
    averageScore_not: Input<Scalar_Int | null>
    averageScore_greater: Input<Scalar_Int | null>
    averageScore_lesser: Input<Scalar_Int | null>
    popularity_not: Input<Scalar_Int | null>
    popularity_greater: Input<Scalar_Int | null>
    popularity_lesser: Input<Scalar_Int | null>
    source_in: Input<(Enum_MediaSource | null)[] | null>
    sort: Input<(Enum_MediaSort | null)[] | null>
  }>
  /** Media Trend query */
  MediaTrend: Field<Type_MediaTrend | null, {
    mediaId: Input<Scalar_Int | null>
    date: Input<Scalar_Int | null>
    trending: Input<Scalar_Int | null>
    averageScore: Input<Scalar_Int | null>
    popularity: Input<Scalar_Int | null>
    episode: Input<Scalar_Int | null>
    releasing: Input<Scalar_Boolean | null>
    mediaId_not: Input<Scalar_Int | null>
    mediaId_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not_in: Input<(Scalar_Int | null)[] | null>
    date_greater: Input<Scalar_Int | null>
    date_lesser: Input<Scalar_Int | null>
    trending_greater: Input<Scalar_Int | null>
    trending_lesser: Input<Scalar_Int | null>
    trending_not: Input<Scalar_Int | null>
    averageScore_greater: Input<Scalar_Int | null>
    averageScore_lesser: Input<Scalar_Int | null>
    averageScore_not: Input<Scalar_Int | null>
    popularity_greater: Input<Scalar_Int | null>
    popularity_lesser: Input<Scalar_Int | null>
    popularity_not: Input<Scalar_Int | null>
    episode_greater: Input<Scalar_Int | null>
    episode_lesser: Input<Scalar_Int | null>
    episode_not: Input<Scalar_Int | null>
    sort: Input<(Enum_MediaTrendSort | null)[] | null>
  }>
  /** Airing schedule query */
  AiringSchedule: Field<Type_AiringSchedule | null, {
    id: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    episode: Input<Scalar_Int | null>
    airingAt: Input<Scalar_Int | null>
    notYetAired: Input<Scalar_Boolean | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not: Input<Scalar_Int | null>
    mediaId_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not_in: Input<(Scalar_Int | null)[] | null>
    episode_not: Input<Scalar_Int | null>
    episode_in: Input<(Scalar_Int | null)[] | null>
    episode_not_in: Input<(Scalar_Int | null)[] | null>
    episode_greater: Input<Scalar_Int | null>
    episode_lesser: Input<Scalar_Int | null>
    airingAt_greater: Input<Scalar_Int | null>
    airingAt_lesser: Input<Scalar_Int | null>
    sort: Input<(Enum_AiringSort | null)[] | null>
  }>
  /** Character query */
  Character: Field<Type_Character | null, {
    id: Input<Scalar_Int | null>
    isBirthday: Input<Scalar_Boolean | null>
    search: Input<Scalar_String | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    sort: Input<(Enum_CharacterSort | null)[] | null>
  }>
  /** Staff query */
  Staff: Field<Type_Staff | null, {
    id: Input<Scalar_Int | null>
    isBirthday: Input<Scalar_Boolean | null>
    search: Input<Scalar_String | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    sort: Input<(Enum_StaffSort | null)[] | null>
  }>
  /** Media list query */
  MediaList: Field<Type_MediaList | null, {
    id: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    userName: Input<Scalar_String | null>
    type: Input<Enum_MediaType | null>
    status: Input<Enum_MediaListStatus | null>
    mediaId: Input<Scalar_Int | null>
    isFollowing: Input<Scalar_Boolean | null>
    notes: Input<Scalar_String | null>
    startedAt: Input<Scalar_FuzzyDateInt | null>
    completedAt: Input<Scalar_FuzzyDateInt | null>
    compareWithAuthList: Input<Scalar_Boolean | null>
    userId_in: Input<(Scalar_Int | null)[] | null>
    status_in: Input<(Enum_MediaListStatus | null)[] | null>
    status_not_in: Input<(Enum_MediaListStatus | null)[] | null>
    status_not: Input<Enum_MediaListStatus | null>
    mediaId_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not_in: Input<(Scalar_Int | null)[] | null>
    notes_like: Input<Scalar_String | null>
    startedAt_greater: Input<Scalar_FuzzyDateInt | null>
    startedAt_lesser: Input<Scalar_FuzzyDateInt | null>
    startedAt_like: Input<Scalar_String | null>
    completedAt_greater: Input<Scalar_FuzzyDateInt | null>
    completedAt_lesser: Input<Scalar_FuzzyDateInt | null>
    completedAt_like: Input<Scalar_String | null>
    sort: Input<(Enum_MediaListSort | null)[] | null>
  }>
  /** Media list collection query, provides list pre-grouped by status & custom lists. User ID and Media Type arguments required. */
  MediaListCollection: Field<Type_MediaListCollection | null, {
    userId: Input<Scalar_Int | null>
    userName: Input<Scalar_String | null>
    type: Input<Enum_MediaType | null>
    status: Input<Enum_MediaListStatus | null>
    notes: Input<Scalar_String | null>
    startedAt: Input<Scalar_FuzzyDateInt | null>
    completedAt: Input<Scalar_FuzzyDateInt | null>
    forceSingleCompletedList: Input<Scalar_Boolean | null>
    chunk: Input<Scalar_Int | null>
    perChunk: Input<Scalar_Int | null>
    status_in: Input<(Enum_MediaListStatus | null)[] | null>
    status_not_in: Input<(Enum_MediaListStatus | null)[] | null>
    status_not: Input<Enum_MediaListStatus | null>
    notes_like: Input<Scalar_String | null>
    startedAt_greater: Input<Scalar_FuzzyDateInt | null>
    startedAt_lesser: Input<Scalar_FuzzyDateInt | null>
    startedAt_like: Input<Scalar_String | null>
    completedAt_greater: Input<Scalar_FuzzyDateInt | null>
    completedAt_lesser: Input<Scalar_FuzzyDateInt | null>
    completedAt_like: Input<Scalar_String | null>
    sort: Input<(Enum_MediaListSort | null)[] | null>
  }>
  /** Collection of all the possible media genres */
  GenreCollection: Field<(Scalar_String | null)[] | null>
  /** Collection of all the possible media tags */
  MediaTagCollection: Field<(Type_MediaTag | null)[] | null, {
    status: Input<Scalar_Int | null>
  }>
  /** User query */
  User: Field<Type_User | null, {
    id: Input<Scalar_Int | null>
    name: Input<Scalar_String | null>
    isModerator: Input<Scalar_Boolean | null>
    search: Input<Scalar_String | null>
    sort: Input<(Enum_UserSort | null)[] | null>
  }>
  /** Get the currently authenticated user */
  Viewer: Field<Type_User | null>
  /** Notification query */
  Notification: Field<Union_NotificationUnion | null, {
    type: Input<Enum_NotificationType | null>
    resetNotificationCount: Input<Scalar_Boolean | null>
    type_in: Input<(Enum_NotificationType | null)[] | null>
  }>
  /** Studio query */
  Studio: Field<Type_Studio | null, {
    id: Input<Scalar_Int | null>
    search: Input<Scalar_String | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    sort: Input<(Enum_StudioSort | null)[] | null>
  }>
  /** Review query */
  Review: Field<Type_Review | null, {
    id: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    mediaType: Input<Enum_MediaType | null>
    sort: Input<(Enum_ReviewSort | null)[] | null>
  }>
  /** Activity query */
  Activity: Field<Union_ActivityUnion | null, {
    id: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    messengerId: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    type: Input<Enum_ActivityType | null>
    isFollowing: Input<Scalar_Boolean | null>
    hasReplies: Input<Scalar_Boolean | null>
    hasRepliesOrTypeText: Input<Scalar_Boolean | null>
    createdAt: Input<Scalar_Int | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    userId_not: Input<Scalar_Int | null>
    userId_in: Input<(Scalar_Int | null)[] | null>
    userId_not_in: Input<(Scalar_Int | null)[] | null>
    messengerId_not: Input<Scalar_Int | null>
    messengerId_in: Input<(Scalar_Int | null)[] | null>
    messengerId_not_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not: Input<Scalar_Int | null>
    mediaId_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not_in: Input<(Scalar_Int | null)[] | null>
    type_not: Input<Enum_ActivityType | null>
    type_in: Input<(Enum_ActivityType | null)[] | null>
    type_not_in: Input<(Enum_ActivityType | null)[] | null>
    createdAt_greater: Input<Scalar_Int | null>
    createdAt_lesser: Input<Scalar_Int | null>
    sort: Input<(Enum_ActivitySort | null)[] | null>
  }>
  /** Activity reply query */
  ActivityReply: Field<Type_ActivityReply | null, {
    id: Input<Scalar_Int | null>
    activityId: Input<Scalar_Int | null>
  }>
  /** Following query */
  Following: Field<Type_User | null, {
    userId: Input<Scalar_Int>
    sort: Input<(Enum_UserSort | null)[] | null>
  }>
  /** Follower query */
  Follower: Field<Type_User | null, {
    userId: Input<Scalar_Int>
    sort: Input<(Enum_UserSort | null)[] | null>
  }>
  /** Thread query */
  Thread: Field<Type_Thread | null, {
    id: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    replyUserId: Input<Scalar_Int | null>
    subscribed: Input<Scalar_Boolean | null>
    categoryId: Input<Scalar_Int | null>
    mediaCategoryId: Input<Scalar_Int | null>
    search: Input<Scalar_String | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    sort: Input<(Enum_ThreadSort | null)[] | null>
  }>
  /** Comment query */
  ThreadComment: Field<(Type_ThreadComment | null)[] | null, {
    id: Input<Scalar_Int | null>
    threadId: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    sort: Input<(Enum_ThreadCommentSort | null)[] | null>
  }>
  /** Recommendation query */
  Recommendation: Field<Type_Recommendation | null, {
    id: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    mediaRecommendationId: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    rating: Input<Scalar_Int | null>
    onList: Input<Scalar_Boolean | null>
    rating_greater: Input<Scalar_Int | null>
    rating_lesser: Input<Scalar_Int | null>
    sort: Input<(Enum_RecommendationSort | null)[] | null>
  }>
  /** Like query */
  Like: Field<Type_User | null, {
    likeableId: Input<Scalar_Int | null>
    type: Input<Enum_LikeableType | null>
  }>
  /** Provide AniList markdown to be converted to html (Requires auth) */
  Markdown: Field<Type_ParsedMarkdown | null, {
    markdown: Input<Scalar_String>
  }>
  AniChartUser: Field<Type_AniChartUser | null>
  /** Site statistics query */
  SiteStatistics: Field<Type_SiteStatistics | null>
  /** ExternalLinkSource collection query */
  ExternalLinkSourceCollection: Field<(Type_MediaExternalLink | null)[] | null, {
    id: Input<Scalar_Int | null>
    type: Input<Enum_ExternalLinkType | null>
    mediaType: Input<Enum_ExternalLinkMediaType | null>
  }>
}>

/** Page of data */
type Type_Page = ObjectType<'Page', {
  /** The pagination information */
  pageInfo: Field<Type_PageInfo | null>
  users: Field<(Type_User | null)[] | null, {
    id: Input<Scalar_Int | null>
    name: Input<Scalar_String | null>
    isModerator: Input<Scalar_Boolean | null>
    search: Input<Scalar_String | null>
    sort: Input<(Enum_UserSort | null)[] | null>
  }>
  media: Field<(Type_Media | null)[] | null, {
    id: Input<Scalar_Int | null>
    idMal: Input<Scalar_Int | null>
    startDate: Input<Scalar_FuzzyDateInt | null>
    endDate: Input<Scalar_FuzzyDateInt | null>
    season: Input<Enum_MediaSeason | null>
    seasonYear: Input<Scalar_Int | null>
    type: Input<Enum_MediaType | null>
    format: Input<Enum_MediaFormat | null>
    status: Input<Enum_MediaStatus | null>
    episodes: Input<Scalar_Int | null>
    duration: Input<Scalar_Int | null>
    chapters: Input<Scalar_Int | null>
    volumes: Input<Scalar_Int | null>
    isAdult: Input<Scalar_Boolean | null>
    genre: Input<Scalar_String | null>
    tag: Input<Scalar_String | null>
    minimumTagRank: Input<Scalar_Int | null>
    tagCategory: Input<Scalar_String | null>
    onList: Input<Scalar_Boolean | null>
    licensedBy: Input<Scalar_String | null>
    licensedById: Input<Scalar_Int | null>
    averageScore: Input<Scalar_Int | null>
    popularity: Input<Scalar_Int | null>
    source: Input<Enum_MediaSource | null>
    countryOfOrigin: Input<Scalar_CountryCode | null>
    isLicensed: Input<Scalar_Boolean | null>
    search: Input<Scalar_String | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    idMal_not: Input<Scalar_Int | null>
    idMal_in: Input<(Scalar_Int | null)[] | null>
    idMal_not_in: Input<(Scalar_Int | null)[] | null>
    startDate_greater: Input<Scalar_FuzzyDateInt | null>
    startDate_lesser: Input<Scalar_FuzzyDateInt | null>
    startDate_like: Input<Scalar_String | null>
    endDate_greater: Input<Scalar_FuzzyDateInt | null>
    endDate_lesser: Input<Scalar_FuzzyDateInt | null>
    endDate_like: Input<Scalar_String | null>
    format_in: Input<(Enum_MediaFormat | null)[] | null>
    format_not: Input<Enum_MediaFormat | null>
    format_not_in: Input<(Enum_MediaFormat | null)[] | null>
    status_in: Input<(Enum_MediaStatus | null)[] | null>
    status_not: Input<Enum_MediaStatus | null>
    status_not_in: Input<(Enum_MediaStatus | null)[] | null>
    episodes_greater: Input<Scalar_Int | null>
    episodes_lesser: Input<Scalar_Int | null>
    duration_greater: Input<Scalar_Int | null>
    duration_lesser: Input<Scalar_Int | null>
    chapters_greater: Input<Scalar_Int | null>
    chapters_lesser: Input<Scalar_Int | null>
    volumes_greater: Input<Scalar_Int | null>
    volumes_lesser: Input<Scalar_Int | null>
    genre_in: Input<(Scalar_String | null)[] | null>
    genre_not_in: Input<(Scalar_String | null)[] | null>
    tag_in: Input<(Scalar_String | null)[] | null>
    tag_not_in: Input<(Scalar_String | null)[] | null>
    tagCategory_in: Input<(Scalar_String | null)[] | null>
    tagCategory_not_in: Input<(Scalar_String | null)[] | null>
    licensedBy_in: Input<(Scalar_String | null)[] | null>
    licensedById_in: Input<(Scalar_Int | null)[] | null>
    averageScore_not: Input<Scalar_Int | null>
    averageScore_greater: Input<Scalar_Int | null>
    averageScore_lesser: Input<Scalar_Int | null>
    popularity_not: Input<Scalar_Int | null>
    popularity_greater: Input<Scalar_Int | null>
    popularity_lesser: Input<Scalar_Int | null>
    source_in: Input<(Enum_MediaSource | null)[] | null>
    sort: Input<(Enum_MediaSort | null)[] | null>
  }>
  characters: Field<(Type_Character | null)[] | null, {
    id: Input<Scalar_Int | null>
    isBirthday: Input<Scalar_Boolean | null>
    search: Input<Scalar_String | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    sort: Input<(Enum_CharacterSort | null)[] | null>
  }>
  staff: Field<(Type_Staff | null)[] | null, {
    id: Input<Scalar_Int | null>
    isBirthday: Input<Scalar_Boolean | null>
    search: Input<Scalar_String | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    sort: Input<(Enum_StaffSort | null)[] | null>
  }>
  studios: Field<(Type_Studio | null)[] | null, {
    id: Input<Scalar_Int | null>
    search: Input<Scalar_String | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    sort: Input<(Enum_StudioSort | null)[] | null>
  }>
  mediaList: Field<(Type_MediaList | null)[] | null, {
    id: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    userName: Input<Scalar_String | null>
    type: Input<Enum_MediaType | null>
    status: Input<Enum_MediaListStatus | null>
    mediaId: Input<Scalar_Int | null>
    isFollowing: Input<Scalar_Boolean | null>
    notes: Input<Scalar_String | null>
    startedAt: Input<Scalar_FuzzyDateInt | null>
    completedAt: Input<Scalar_FuzzyDateInt | null>
    compareWithAuthList: Input<Scalar_Boolean | null>
    userId_in: Input<(Scalar_Int | null)[] | null>
    status_in: Input<(Enum_MediaListStatus | null)[] | null>
    status_not_in: Input<(Enum_MediaListStatus | null)[] | null>
    status_not: Input<Enum_MediaListStatus | null>
    mediaId_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not_in: Input<(Scalar_Int | null)[] | null>
    notes_like: Input<Scalar_String | null>
    startedAt_greater: Input<Scalar_FuzzyDateInt | null>
    startedAt_lesser: Input<Scalar_FuzzyDateInt | null>
    startedAt_like: Input<Scalar_String | null>
    completedAt_greater: Input<Scalar_FuzzyDateInt | null>
    completedAt_lesser: Input<Scalar_FuzzyDateInt | null>
    completedAt_like: Input<Scalar_String | null>
    sort: Input<(Enum_MediaListSort | null)[] | null>
  }>
  airingSchedules: Field<(Type_AiringSchedule | null)[] | null, {
    id: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    episode: Input<Scalar_Int | null>
    airingAt: Input<Scalar_Int | null>
    notYetAired: Input<Scalar_Boolean | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not: Input<Scalar_Int | null>
    mediaId_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not_in: Input<(Scalar_Int | null)[] | null>
    episode_not: Input<Scalar_Int | null>
    episode_in: Input<(Scalar_Int | null)[] | null>
    episode_not_in: Input<(Scalar_Int | null)[] | null>
    episode_greater: Input<Scalar_Int | null>
    episode_lesser: Input<Scalar_Int | null>
    airingAt_greater: Input<Scalar_Int | null>
    airingAt_lesser: Input<Scalar_Int | null>
    sort: Input<(Enum_AiringSort | null)[] | null>
  }>
  mediaTrends: Field<(Type_MediaTrend | null)[] | null, {
    mediaId: Input<Scalar_Int | null>
    date: Input<Scalar_Int | null>
    trending: Input<Scalar_Int | null>
    averageScore: Input<Scalar_Int | null>
    popularity: Input<Scalar_Int | null>
    episode: Input<Scalar_Int | null>
    releasing: Input<Scalar_Boolean | null>
    mediaId_not: Input<Scalar_Int | null>
    mediaId_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not_in: Input<(Scalar_Int | null)[] | null>
    date_greater: Input<Scalar_Int | null>
    date_lesser: Input<Scalar_Int | null>
    trending_greater: Input<Scalar_Int | null>
    trending_lesser: Input<Scalar_Int | null>
    trending_not: Input<Scalar_Int | null>
    averageScore_greater: Input<Scalar_Int | null>
    averageScore_lesser: Input<Scalar_Int | null>
    averageScore_not: Input<Scalar_Int | null>
    popularity_greater: Input<Scalar_Int | null>
    popularity_lesser: Input<Scalar_Int | null>
    popularity_not: Input<Scalar_Int | null>
    episode_greater: Input<Scalar_Int | null>
    episode_lesser: Input<Scalar_Int | null>
    episode_not: Input<Scalar_Int | null>
    sort: Input<(Enum_MediaTrendSort | null)[] | null>
  }>
  notifications: Field<(Union_NotificationUnion | null)[] | null, {
    type: Input<Enum_NotificationType | null>
    resetNotificationCount: Input<Scalar_Boolean | null>
    type_in: Input<(Enum_NotificationType | null)[] | null>
  }>
  followers: Field<(Type_User | null)[] | null, {
    userId: Input<Scalar_Int>
    sort: Input<(Enum_UserSort | null)[] | null>
  }>
  following: Field<(Type_User | null)[] | null, {
    userId: Input<Scalar_Int>
    sort: Input<(Enum_UserSort | null)[] | null>
  }>
  activities: Field<(Union_ActivityUnion | null)[] | null, {
    id: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    messengerId: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    type: Input<Enum_ActivityType | null>
    isFollowing: Input<Scalar_Boolean | null>
    hasReplies: Input<Scalar_Boolean | null>
    hasRepliesOrTypeText: Input<Scalar_Boolean | null>
    createdAt: Input<Scalar_Int | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    userId_not: Input<Scalar_Int | null>
    userId_in: Input<(Scalar_Int | null)[] | null>
    userId_not_in: Input<(Scalar_Int | null)[] | null>
    messengerId_not: Input<Scalar_Int | null>
    messengerId_in: Input<(Scalar_Int | null)[] | null>
    messengerId_not_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not: Input<Scalar_Int | null>
    mediaId_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not_in: Input<(Scalar_Int | null)[] | null>
    type_not: Input<Enum_ActivityType | null>
    type_in: Input<(Enum_ActivityType | null)[] | null>
    type_not_in: Input<(Enum_ActivityType | null)[] | null>
    createdAt_greater: Input<Scalar_Int | null>
    createdAt_lesser: Input<Scalar_Int | null>
    sort: Input<(Enum_ActivitySort | null)[] | null>
  }>
  activityReplies: Field<(Type_ActivityReply | null)[] | null, {
    id: Input<Scalar_Int | null>
    activityId: Input<Scalar_Int | null>
  }>
  threads: Field<(Type_Thread | null)[] | null, {
    id: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    replyUserId: Input<Scalar_Int | null>
    subscribed: Input<Scalar_Boolean | null>
    categoryId: Input<Scalar_Int | null>
    mediaCategoryId: Input<Scalar_Int | null>
    search: Input<Scalar_String | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    sort: Input<(Enum_ThreadSort | null)[] | null>
  }>
  threadComments: Field<(Type_ThreadComment | null)[] | null, {
    id: Input<Scalar_Int | null>
    threadId: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    sort: Input<(Enum_ThreadCommentSort | null)[] | null>
  }>
  reviews: Field<(Type_Review | null)[] | null, {
    id: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    mediaType: Input<Enum_MediaType | null>
    sort: Input<(Enum_ReviewSort | null)[] | null>
  }>
  recommendations: Field<(Type_Recommendation | null)[] | null, {
    id: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    mediaRecommendationId: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    rating: Input<Scalar_Int | null>
    onList: Input<Scalar_Boolean | null>
    rating_greater: Input<Scalar_Int | null>
    rating_lesser: Input<Scalar_Int | null>
    sort: Input<(Enum_RecommendationSort | null)[] | null>
  }>
  likes: Field<(Type_User | null)[] | null, {
    likeableId: Input<Scalar_Int | null>
    type: Input<Enum_LikeableType | null>
  }>
}>

type Type_PageInfo = ObjectType<'PageInfo', {
  /** The total number of items. Note: This value is not guaranteed to be accurate, do not rely on this for logic */
  total: Field<Scalar_Int | null>
  /** The count on a page */
  perPage: Field<Scalar_Int | null>
  /** The current page */
  currentPage: Field<Scalar_Int | null>
  /** The last page */
  lastPage: Field<Scalar_Int | null>
  /** If there is another page */
  hasNextPage: Field<Scalar_Boolean | null>
}>

/** A user */
type Type_User = ObjectType<'User', {
  /** The id of the user */
  id: Field<Scalar_Int>
  /** The name of the user */
  name: Field<Scalar_String>
  /** The bio written by user (Markdown) */
  about: Field<Scalar_String | null, {
    asHtml: Input<Scalar_Boolean | null>
  }>
  /** The user's avatar images */
  avatar: Field<Type_UserAvatar | null>
  /** The user's banner images */
  bannerImage: Field<Scalar_String | null>
  /** If the authenticated user if following this user */
  isFollowing: Field<Scalar_Boolean | null>
  /** If this user if following the authenticated user */
  isFollower: Field<Scalar_Boolean | null>
  /** If the user is blocked by the authenticated user */
  isBlocked: Field<Scalar_Boolean | null>
  bans: Field<Scalar_Json | null>
  /** The user's general options */
  options: Field<Type_UserOptions | null>
  /** The user's media list options */
  mediaListOptions: Field<Type_MediaListOptions | null>
  /** The users favourites */
  favourites: Field<Type_Favourites | null, {
    page: Input<Scalar_Int | null>
  }>
  /** The users anime & manga list statistics */
  statistics: Field<Type_UserStatisticTypes | null>
  /** The number of unread notifications the user has */
  unreadNotificationCount: Field<Scalar_Int | null>
  /** The url for the user page on the AniList website */
  siteUrl: Field<Scalar_String | null>
  /** The donation tier of the user */
  donatorTier: Field<Scalar_Int | null>
  /** Custom donation badge text */
  donatorBadge: Field<Scalar_String | null>
  /** The user's moderator roles if they are a site moderator */
  moderatorRoles: Field<(Enum_ModRole | null)[] | null>
  /** When the user's account was created. (Does not exist for accounts created before 2020) */
  createdAt: Field<Scalar_Int | null>
  /** When the user's data was last updated */
  updatedAt: Field<Scalar_Int | null>
  /**
   * The user's statistics
   * @deprecated Deprecated. Replaced with statistics field.
   */
  stats: Field<Type_UserStats | null>
  /**
   * If the user is a moderator or data moderator
   * @deprecated Deprecated. Replaced with moderatorRoles field.
   */
  moderatorStatus: Field<Scalar_String | null>
  /** The user's previously used names. */
  previousNames: Field<(Type_UserPreviousName | null)[] | null>
}>

/** A user's avatars */
type Type_UserAvatar = ObjectType<'UserAvatar', {
  /** The avatar of user at its largest size */
  large: Field<Scalar_String | null>
  /** The avatar of user at medium size */
  medium: Field<Scalar_String | null>
}>

/** A user's general options */
type Type_UserOptions = ObjectType<'UserOptions', {
  /** The language the user wants to see media titles in */
  titleLanguage: Field<Enum_UserTitleLanguage | null>
  /** Whether the user has enabled viewing of 18+ content */
  displayAdultContent: Field<Scalar_Boolean | null>
  /** Whether the user receives notifications when a show they are watching aires */
  airingNotifications: Field<Scalar_Boolean | null>
  /** Profile highlight color (blue, purple, pink, orange, red, green, gray) */
  profileColor: Field<Scalar_String | null>
  /** Notification options */
  notificationOptions: Field<(Type_NotificationOption | null)[] | null>
  /** The user's timezone offset (Auth user only) */
  timezone: Field<Scalar_String | null>
  /** Minutes between activity for them to be merged together. 0 is Never, Above 2 weeks (20160 mins) is Always. */
  activityMergeTime: Field<Scalar_Int | null>
  /** The language the user wants to see staff and character names in */
  staffNameLanguage: Field<Enum_UserStaffNameLanguage | null>
  /** Whether the user only allow messages from users they follow */
  restrictMessagesToFollowing: Field<Scalar_Boolean | null>
  /** The list activity types the user has disabled from being created from list updates */
  disabledListActivity: Field<(Type_ListActivityOption | null)[] | null>
}>

/** Notification option */
type Type_NotificationOption = ObjectType<'NotificationOption', {
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** Whether this type of notification is enabled */
  enabled: Field<Scalar_Boolean | null>
}>

type Type_ListActivityOption = ObjectType<'ListActivityOption', {
  disabled: Field<Scalar_Boolean | null>
  type: Field<Enum_MediaListStatus | null>
}>

/** A user's list options */
type Type_MediaListOptions = ObjectType<'MediaListOptions', {
  /** The score format the user is using for media lists */
  scoreFormat: Field<Enum_ScoreFormat | null>
  /** The default order list rows should be displayed in */
  rowOrder: Field<Scalar_String | null>
  /** @deprecated No longer used */
  useLegacyLists: Field<Scalar_Boolean | null>
  /** The user's anime list options */
  animeList: Field<Type_MediaListTypeOptions | null>
  /** The user's manga list options */
  mangaList: Field<Type_MediaListTypeOptions | null>
  /**
   * The list theme options for both lists
   * @deprecated No longer used
   */
  sharedTheme: Field<Scalar_Json | null>
  /**
   * If the shared theme should be used instead of the individual list themes
   * @deprecated No longer used
   */
  sharedThemeEnabled: Field<Scalar_Boolean | null>
}>

/** A user's list options for anime or manga lists */
type Type_MediaListTypeOptions = ObjectType<'MediaListTypeOptions', {
  /** The order each list should be displayed in */
  sectionOrder: Field<(Scalar_String | null)[] | null>
  /** If the completed sections of the list should be separated by format */
  splitCompletedSectionByFormat: Field<Scalar_Boolean | null>
  /**
   * The list theme options
   * @deprecated This field has not yet been fully implemented and may change without warning
   */
  theme: Field<Scalar_Json | null>
  /** The names of the user's custom lists */
  customLists: Field<(Scalar_String | null)[] | null>
  /** The names of the user's advanced scoring sections */
  advancedScoring: Field<(Scalar_String | null)[] | null>
  /** If advanced scoring is enabled */
  advancedScoringEnabled: Field<Scalar_Boolean | null>
}>

/** User's favourite anime, manga, characters, staff & studios */
type Type_Favourites = ObjectType<'Favourites', {
  /** Favourite anime */
  anime: Field<Type_MediaConnection | null, {
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** Favourite manga */
  manga: Field<Type_MediaConnection | null, {
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** Favourite characters */
  characters: Field<Type_CharacterConnection | null, {
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** Favourite staff */
  staff: Field<Type_StaffConnection | null, {
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** Favourite studios */
  studios: Field<Type_StudioConnection | null, {
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
}>

type Type_MediaConnection = ObjectType<'MediaConnection', {
  edges: Field<(Type_MediaEdge | null)[] | null>
  nodes: Field<(Type_Media | null)[] | null>
  /** The pagination information */
  pageInfo: Field<Type_PageInfo | null>
}>

/** Media connection edge */
type Type_MediaEdge = ObjectType<'MediaEdge', {
  node: Field<Type_Media | null>
  /** The id of the connection */
  id: Field<Scalar_Int | null>
  /** The type of relation to the parent model */
  relationType: Field<Enum_MediaRelation | null, {
    version: Input<Scalar_Int | null>
  }>
  /** If the studio is the main animation studio of the media (For Studio->MediaConnection field only) */
  isMainStudio: Field<Scalar_Boolean>
  /** The characters in the media voiced by the parent actor */
  characters: Field<(Type_Character | null)[] | null>
  /** The characters role in the media */
  characterRole: Field<Enum_CharacterRole | null>
  /** Media specific character name */
  characterName: Field<Scalar_String | null>
  /** Notes regarding the VA's role for the character */
  roleNotes: Field<Scalar_String | null>
  /** Used for grouping roles where multiple dubs exist for the same language. Either dubbing company name or language variant. */
  dubGroup: Field<Scalar_String | null>
  /** The role of the staff member in the production of the media */
  staffRole: Field<Scalar_String | null>
  /** The voice actors of the character */
  voiceActors: Field<(Type_Staff | null)[] | null, {
    language: Input<Enum_StaffLanguage | null>
    sort: Input<(Enum_StaffSort | null)[] | null>
  }>
  /** The voice actors of the character with role date */
  voiceActorRoles: Field<(Type_StaffRoleType | null)[] | null, {
    language: Input<Enum_StaffLanguage | null>
    sort: Input<(Enum_StaffSort | null)[] | null>
  }>
  /** The order the media should be displayed from the users favourites */
  favouriteOrder: Field<Scalar_Int | null>
}>

/** Anime or Manga */
type Type_Media = ObjectType<'Media', {
  /** The id of the media */
  id: Field<Scalar_Int>
  /** The mal id of the media */
  idMal: Field<Scalar_Int | null>
  /** The official titles of the media in various languages */
  title: Field<Type_MediaTitle | null>
  /** The type of the media; anime or manga */
  type: Field<Enum_MediaType | null>
  /** The format the media was released in */
  format: Field<Enum_MediaFormat | null>
  /** The current releasing status of the media */
  status: Field<Enum_MediaStatus | null, {
    version: Input<Scalar_Int | null>
  }>
  /** Short description of the media's story and characters */
  description: Field<Scalar_String | null, {
    asHtml: Input<Scalar_Boolean | null>
  }>
  /** The first official release date of the media */
  startDate: Field<Type_FuzzyDate | null>
  /** The last official release date of the media */
  endDate: Field<Type_FuzzyDate | null>
  /** The season the media was initially released in */
  season: Field<Enum_MediaSeason | null>
  /** The season year the media was initially released in */
  seasonYear: Field<Scalar_Int | null>
  /** The year & season the media was initially released in */
  seasonInt: Field<Scalar_Int | null>
  /** The amount of episodes the anime has when complete */
  episodes: Field<Scalar_Int | null>
  /** The general length of each anime episode in minutes */
  duration: Field<Scalar_Int | null>
  /** The amount of chapters the manga has when complete */
  chapters: Field<Scalar_Int | null>
  /** The amount of volumes the manga has when complete */
  volumes: Field<Scalar_Int | null>
  /** Where the media was created. (ISO 3166-1 alpha-2) */
  countryOfOrigin: Field<Scalar_CountryCode | null>
  /** If the media is officially licensed or a self-published doujin release */
  isLicensed: Field<Scalar_Boolean | null>
  /** Source type the media was adapted from. */
  source: Field<Enum_MediaSource | null, {
    version: Input<Scalar_Int | null>
  }>
  /** Official Twitter hashtags for the media */
  hashtag: Field<Scalar_String | null>
  /** Media trailer or advertisement */
  trailer: Field<Type_MediaTrailer | null>
  /** When the media's data was last updated */
  updatedAt: Field<Scalar_Int | null>
  /** The cover images of the media */
  coverImage: Field<Type_MediaCoverImage | null>
  /** The banner image of the media */
  bannerImage: Field<Scalar_String | null>
  /** The genres of the media */
  genres: Field<(Scalar_String | null)[] | null>
  /** Alternative titles of the media */
  synonyms: Field<(Scalar_String | null)[] | null>
  /** A weighted average score of all the user's scores of the media */
  averageScore: Field<Scalar_Int | null>
  /** Mean score of all the user's scores of the media */
  meanScore: Field<Scalar_Int | null>
  /** The number of users with the media on their list */
  popularity: Field<Scalar_Int | null>
  /** Locked media may not be added to lists our favorited. This may be due to the entry pending for deletion or other reasons. */
  isLocked: Field<Scalar_Boolean | null>
  /** The amount of related activity in the past hour */
  trending: Field<Scalar_Int | null>
  /** The amount of user's who have favourited the media */
  favourites: Field<Scalar_Int | null>
  /** List of tags that describes elements and themes of the media */
  tags: Field<(Type_MediaTag | null)[] | null>
  /** Other media in the same or connecting franchise */
  relations: Field<Type_MediaConnection | null>
  /** The characters in the media */
  characters: Field<Type_CharacterConnection | null, {
    sort: Input<(Enum_CharacterSort | null)[] | null>
    role: Input<Enum_CharacterRole | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** The staff who produced the media */
  staff: Field<Type_StaffConnection | null, {
    sort: Input<(Enum_StaffSort | null)[] | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** The companies who produced the media */
  studios: Field<Type_StudioConnection | null, {
    sort: Input<(Enum_StudioSort | null)[] | null>
    isMain: Input<Scalar_Boolean | null>
  }>
  /** If the media is marked as favourite by the current authenticated user */
  isFavourite: Field<Scalar_Boolean>
  /** If the media is blocked from being added to favourites */
  isFavouriteBlocked: Field<Scalar_Boolean>
  /** If the media is intended only for 18+ adult audiences */
  isAdult: Field<Scalar_Boolean | null>
  /** The media's next episode airing schedule */
  nextAiringEpisode: Field<Type_AiringSchedule | null>
  /** The media's entire airing schedule */
  airingSchedule: Field<Type_AiringScheduleConnection | null, {
    notYetAired: Input<Scalar_Boolean | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** The media's daily trend stats */
  trends: Field<Type_MediaTrendConnection | null, {
    sort: Input<(Enum_MediaTrendSort | null)[] | null>
    releasing: Input<Scalar_Boolean | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** External links to another site related to the media */
  externalLinks: Field<(Type_MediaExternalLink | null)[] | null>
  /** Data and links to legal streaming episodes on external sites */
  streamingEpisodes: Field<(Type_MediaStreamingEpisode | null)[] | null>
  /** The ranking of the media in a particular time span and format compared to other media */
  rankings: Field<(Type_MediaRank | null)[] | null>
  /** The authenticated user's media list entry for the media */
  mediaListEntry: Field<Type_MediaList | null>
  /** User reviews of the media */
  reviews: Field<Type_ReviewConnection | null, {
    limit: Input<Scalar_Int | null>
    sort: Input<(Enum_ReviewSort | null)[] | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** User recommendations for similar media */
  recommendations: Field<Type_RecommendationConnection | null, {
    sort: Input<(Enum_RecommendationSort | null)[] | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  stats: Field<Type_MediaStats | null>
  /** The url for the media page on the AniList website */
  siteUrl: Field<Scalar_String | null>
  /** If the media should have forum thread automatically created for it on airing episode release */
  autoCreateForumThread: Field<Scalar_Boolean | null>
  /** If the media is blocked from being recommended to/from */
  isRecommendationBlocked: Field<Scalar_Boolean | null>
  /** If the media is blocked from being reviewed */
  isReviewBlocked: Field<Scalar_Boolean | null>
  /** Notes for site moderators */
  modNotes: Field<Scalar_String | null>
}>

/** The official titles of the media in various languages */
type Type_MediaTitle = ObjectType<'MediaTitle', {
  /** The romanization of the native language title */
  romaji: Field<Scalar_String | null, {
    stylised: Input<Scalar_Boolean | null>
  }>
  /** The official english title */
  english: Field<Scalar_String | null, {
    stylised: Input<Scalar_Boolean | null>
  }>
  /** Official title in it's native language */
  native: Field<Scalar_String | null, {
    stylised: Input<Scalar_Boolean | null>
  }>
  /** The currently authenticated users preferred title language. Default romaji for non-authenticated */
  userPreferred: Field<Scalar_String | null>
}>

/** Date object that allows for incomplete date values (fuzzy) */
type Type_FuzzyDate = ObjectType<'FuzzyDate', {
  /** Numeric Year (2017) */
  year: Field<Scalar_Int | null>
  /** Numeric Month (3) */
  month: Field<Scalar_Int | null>
  /** Numeric Day (24) */
  day: Field<Scalar_Int | null>
}>

/** Media trailer or advertisement */
type Type_MediaTrailer = ObjectType<'MediaTrailer', {
  /** The trailer video id */
  id: Field<Scalar_String | null>
  /** The site the video is hosted by (Currently either youtube or dailymotion) */
  site: Field<Scalar_String | null>
  /** The url for the thumbnail image of the video */
  thumbnail: Field<Scalar_String | null>
}>

type Type_MediaCoverImage = ObjectType<'MediaCoverImage', {
  /** The cover image url of the media at its largest size. If this size isn't available, large will be provided instead. */
  extraLarge: Field<Scalar_String | null>
  /** The cover image url of the media at a large size */
  large: Field<Scalar_String | null>
  /** The cover image url of the media at medium size */
  medium: Field<Scalar_String | null>
  /** Average #hex color of cover image */
  color: Field<Scalar_String | null>
}>

/** A tag that describes a theme or element of the media */
type Type_MediaTag = ObjectType<'MediaTag', {
  /** The id of the tag */
  id: Field<Scalar_Int>
  /** The name of the tag */
  name: Field<Scalar_String>
  /** A general description of the tag */
  description: Field<Scalar_String | null>
  /** The categories of tags this tag belongs to */
  category: Field<Scalar_String | null>
  /** The relevance ranking of the tag out of the 100 for this media */
  rank: Field<Scalar_Int | null>
  /** If the tag could be a spoiler for any media */
  isGeneralSpoiler: Field<Scalar_Boolean | null>
  /** If the tag is a spoiler for this media */
  isMediaSpoiler: Field<Scalar_Boolean | null>
  /** If the tag is only for adult 18+ media */
  isAdult: Field<Scalar_Boolean | null>
  /** The user who submitted the tag */
  userId: Field<Scalar_Int | null>
}>

type Type_CharacterConnection = ObjectType<'CharacterConnection', {
  edges: Field<(Type_CharacterEdge | null)[] | null>
  nodes: Field<(Type_Character | null)[] | null>
  /** The pagination information */
  pageInfo: Field<Type_PageInfo | null>
}>

/** Character connection edge */
type Type_CharacterEdge = ObjectType<'CharacterEdge', {
  node: Field<Type_Character | null>
  /** The id of the connection */
  id: Field<Scalar_Int | null>
  /** The characters role in the media */
  role: Field<Enum_CharacterRole | null>
  /** Media specific character name */
  name: Field<Scalar_String | null>
  /** The voice actors of the character */
  voiceActors: Field<(Type_Staff | null)[] | null, {
    language: Input<Enum_StaffLanguage | null>
    sort: Input<(Enum_StaffSort | null)[] | null>
  }>
  /** The voice actors of the character with role date */
  voiceActorRoles: Field<(Type_StaffRoleType | null)[] | null, {
    language: Input<Enum_StaffLanguage | null>
    sort: Input<(Enum_StaffSort | null)[] | null>
  }>
  /** The media the character is in */
  media: Field<(Type_Media | null)[] | null>
  /** The order the character should be displayed from the users favourites */
  favouriteOrder: Field<Scalar_Int | null>
}>

/** A character that features in an anime or manga */
type Type_Character = ObjectType<'Character', {
  /** The id of the character */
  id: Field<Scalar_Int>
  /** The names of the character */
  name: Field<Type_CharacterName | null>
  /** Character images */
  image: Field<Type_CharacterImage | null>
  /** A general description of the character */
  description: Field<Scalar_String | null, {
    asHtml: Input<Scalar_Boolean | null>
  }>
  /** The character's gender. Usually Male, Female, or Non-binary but can be any string. */
  gender: Field<Scalar_String | null>
  /** The character's birth date */
  dateOfBirth: Field<Type_FuzzyDate | null>
  /** The character's age. Note this is a string, not an int, it may contain further text and additional ages. */
  age: Field<Scalar_String | null>
  /** The characters blood type */
  bloodType: Field<Scalar_String | null>
  /** If the character is marked as favourite by the currently authenticated user */
  isFavourite: Field<Scalar_Boolean>
  /** If the character is blocked from being added to favourites */
  isFavouriteBlocked: Field<Scalar_Boolean>
  /** The url for the character page on the AniList website */
  siteUrl: Field<Scalar_String | null>
  /** Media that includes the character */
  media: Field<Type_MediaConnection | null, {
    sort: Input<(Enum_MediaSort | null)[] | null>
    type: Input<Enum_MediaType | null>
    onList: Input<Scalar_Boolean | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** @deprecated No data available */
  updatedAt: Field<Scalar_Int | null>
  /** The amount of user's who have favourited the character */
  favourites: Field<Scalar_Int | null>
  /** Notes for site moderators */
  modNotes: Field<Scalar_String | null>
}>

/** The names of the character */
type Type_CharacterName = ObjectType<'CharacterName', {
  /** The character's given name */
  first: Field<Scalar_String | null>
  /** The character's middle name */
  middle: Field<Scalar_String | null>
  /** The character's surname */
  last: Field<Scalar_String | null>
  /** The character's first and last name */
  full: Field<Scalar_String | null>
  /** The character's full name in their native language */
  native: Field<Scalar_String | null>
  /** Other names the character might be referred to as */
  alternative: Field<(Scalar_String | null)[] | null>
  /** Other names the character might be referred to as but are spoilers */
  alternativeSpoiler: Field<(Scalar_String | null)[] | null>
  /** The currently authenticated users preferred name language. Default romaji for non-authenticated */
  userPreferred: Field<Scalar_String | null>
}>

type Type_CharacterImage = ObjectType<'CharacterImage', {
  /** The character's image of media at its largest size */
  large: Field<Scalar_String | null>
  /** The character's image of media at medium size */
  medium: Field<Scalar_String | null>
}>

/** Voice actors or production staff */
type Type_Staff = ObjectType<'Staff', {
  /** The id of the staff member */
  id: Field<Scalar_Int>
  /** The names of the staff member */
  name: Field<Type_StaffName | null>
  /**
   * The primary language the staff member dub's in
   * @deprecated Replaced with languageV2
   */
  language: Field<Enum_StaffLanguage | null>
  /** The primary language of the staff member. Current values: Japanese, English, Korean, Italian, Spanish, Portuguese, French, German, Hebrew, Hungarian, Chinese, Arabic, Filipino, Catalan, Finnish, Turkish, Dutch, Swedish, Thai, Tagalog, Malaysian, Indonesian, Vietnamese, Nepali, Hindi, Urdu */
  languageV2: Field<Scalar_String | null>
  /** The staff images */
  image: Field<Type_StaffImage | null>
  /** A general description of the staff member */
  description: Field<Scalar_String | null, {
    asHtml: Input<Scalar_Boolean | null>
  }>
  /** The person's primary occupations */
  primaryOccupations: Field<(Scalar_String | null)[] | null>
  /** The staff's gender. Usually Male, Female, or Non-binary but can be any string. */
  gender: Field<Scalar_String | null>
  dateOfBirth: Field<Type_FuzzyDate | null>
  dateOfDeath: Field<Type_FuzzyDate | null>
  /** The person's age in years */
  age: Field<Scalar_Int | null>
  /** [startYear, endYear] (If the 2nd value is not present staff is still active) */
  yearsActive: Field<(Scalar_Int | null)[] | null>
  /** The persons birthplace or hometown */
  homeTown: Field<Scalar_String | null>
  /** The persons blood type */
  bloodType: Field<Scalar_String | null>
  /** If the staff member is marked as favourite by the currently authenticated user */
  isFavourite: Field<Scalar_Boolean>
  /** If the staff member is blocked from being added to favourites */
  isFavouriteBlocked: Field<Scalar_Boolean>
  /** The url for the staff page on the AniList website */
  siteUrl: Field<Scalar_String | null>
  /** Media where the staff member has a production role */
  staffMedia: Field<Type_MediaConnection | null, {
    sort: Input<(Enum_MediaSort | null)[] | null>
    type: Input<Enum_MediaType | null>
    onList: Input<Scalar_Boolean | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** Characters voiced by the actor */
  characters: Field<Type_CharacterConnection | null, {
    sort: Input<(Enum_CharacterSort | null)[] | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** Media the actor voiced characters in. (Same data as characters with media as node instead of characters) */
  characterMedia: Field<Type_MediaConnection | null, {
    sort: Input<(Enum_MediaSort | null)[] | null>
    onList: Input<Scalar_Boolean | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** @deprecated No data available */
  updatedAt: Field<Scalar_Int | null>
  /** Staff member that the submission is referencing */
  staff: Field<Type_Staff | null>
  /** Submitter for the submission */
  submitter: Field<Type_User | null>
  /** Status of the submission */
  submissionStatus: Field<Scalar_Int | null>
  /** Inner details of submission status */
  submissionNotes: Field<Scalar_String | null>
  /** The amount of user's who have favourited the staff member */
  favourites: Field<Scalar_Int | null>
  /** Notes for site moderators */
  modNotes: Field<Scalar_String | null>
}>

/** The names of the staff member */
type Type_StaffName = ObjectType<'StaffName', {
  /** The person's given name */
  first: Field<Scalar_String | null>
  /** The person's middle name */
  middle: Field<Scalar_String | null>
  /** The person's surname */
  last: Field<Scalar_String | null>
  /** The person's first and last name */
  full: Field<Scalar_String | null>
  /** The person's full name in their native language */
  native: Field<Scalar_String | null>
  /** Other names the staff member might be referred to as (pen names) */
  alternative: Field<(Scalar_String | null)[] | null>
  /** The currently authenticated users preferred name language. Default romaji for non-authenticated */
  userPreferred: Field<Scalar_String | null>
}>

type Type_StaffImage = ObjectType<'StaffImage', {
  /** The person's image of media at its largest size */
  large: Field<Scalar_String | null>
  /** The person's image of media at medium size */
  medium: Field<Scalar_String | null>
}>

/** Voice actor role for a character */
type Type_StaffRoleType = ObjectType<'StaffRoleType', {
  /** The voice actors of the character */
  voiceActor: Field<Type_Staff | null>
  /** Notes regarding the VA's role for the character */
  roleNotes: Field<Scalar_String | null>
  /** Used for grouping roles where multiple dubs exist for the same language. Either dubbing company name or language variant. */
  dubGroup: Field<Scalar_String | null>
}>

type Type_StaffConnection = ObjectType<'StaffConnection', {
  edges: Field<(Type_StaffEdge | null)[] | null>
  nodes: Field<(Type_Staff | null)[] | null>
  /** The pagination information */
  pageInfo: Field<Type_PageInfo | null>
}>

/** Staff connection edge */
type Type_StaffEdge = ObjectType<'StaffEdge', {
  node: Field<Type_Staff | null>
  /** The id of the connection */
  id: Field<Scalar_Int | null>
  /** The role of the staff member in the production of the media */
  role: Field<Scalar_String | null>
  /** The order the staff should be displayed from the users favourites */
  favouriteOrder: Field<Scalar_Int | null>
}>

type Type_StudioConnection = ObjectType<'StudioConnection', {
  edges: Field<(Type_StudioEdge | null)[] | null>
  nodes: Field<(Type_Studio | null)[] | null>
  /** The pagination information */
  pageInfo: Field<Type_PageInfo | null>
}>

/** Studio connection edge */
type Type_StudioEdge = ObjectType<'StudioEdge', {
  node: Field<Type_Studio | null>
  /** The id of the connection */
  id: Field<Scalar_Int | null>
  /** If the studio is the main animation studio of the anime */
  isMain: Field<Scalar_Boolean>
  /** The order the character should be displayed from the users favourites */
  favouriteOrder: Field<Scalar_Int | null>
}>

/** Animation or production company */
type Type_Studio = ObjectType<'Studio', {
  /** The id of the studio */
  id: Field<Scalar_Int>
  /** The name of the studio */
  name: Field<Scalar_String>
  /** If the studio is an animation studio or a different kind of company */
  isAnimationStudio: Field<Scalar_Boolean>
  /** The media the studio has worked on */
  media: Field<Type_MediaConnection | null, {
    sort: Input<(Enum_MediaSort | null)[] | null>
    isMain: Input<Scalar_Boolean | null>
    onList: Input<Scalar_Boolean | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  /** The url for the studio page on the AniList website */
  siteUrl: Field<Scalar_String | null>
  /** If the studio is marked as favourite by the currently authenticated user */
  isFavourite: Field<Scalar_Boolean>
  /** The amount of user's who have favourited the studio */
  favourites: Field<Scalar_Int | null>
}>

/** Media Airing Schedule. NOTE: We only aim to guarantee that FUTURE airing data is present and accurate. */
type Type_AiringSchedule = ObjectType<'AiringSchedule', {
  /** The id of the airing schedule item */
  id: Field<Scalar_Int>
  /** The time the episode airs at */
  airingAt: Field<Scalar_Int>
  /** Seconds until episode starts airing */
  timeUntilAiring: Field<Scalar_Int>
  /** The airing episode number */
  episode: Field<Scalar_Int>
  /** The associate media id of the airing episode */
  mediaId: Field<Scalar_Int>
  /** The associate media of the airing episode */
  media: Field<Type_Media | null>
}>

type Type_AiringScheduleConnection = ObjectType<'AiringScheduleConnection', {
  edges: Field<(Type_AiringScheduleEdge | null)[] | null>
  nodes: Field<(Type_AiringSchedule | null)[] | null>
  /** The pagination information */
  pageInfo: Field<Type_PageInfo | null>
}>

/** AiringSchedule connection edge */
type Type_AiringScheduleEdge = ObjectType<'AiringScheduleEdge', {
  node: Field<Type_AiringSchedule | null>
  /** The id of the connection */
  id: Field<Scalar_Int | null>
}>

type Type_MediaTrendConnection = ObjectType<'MediaTrendConnection', {
  edges: Field<(Type_MediaTrendEdge | null)[] | null>
  nodes: Field<(Type_MediaTrend | null)[] | null>
  /** The pagination information */
  pageInfo: Field<Type_PageInfo | null>
}>

/** Media trend connection edge */
type Type_MediaTrendEdge = ObjectType<'MediaTrendEdge', {
  node: Field<Type_MediaTrend | null>
}>

/** Daily media statistics */
type Type_MediaTrend = ObjectType<'MediaTrend', {
  /** The id of the tag */
  mediaId: Field<Scalar_Int>
  /** The day the data was recorded (timestamp) */
  date: Field<Scalar_Int>
  /** The amount of media activity on the day */
  trending: Field<Scalar_Int>
  /** A weighted average score of all the user's scores of the media */
  averageScore: Field<Scalar_Int | null>
  /** The number of users with the media on their list */
  popularity: Field<Scalar_Int | null>
  /** The number of users with watching/reading the media */
  inProgress: Field<Scalar_Int | null>
  /** If the media was being released at this time */
  releasing: Field<Scalar_Boolean>
  /** The episode number of the anime released on this day */
  episode: Field<Scalar_Int | null>
  /** The related media */
  media: Field<Type_Media | null>
}>

/** An external link to another site related to the media or staff member */
type Type_MediaExternalLink = ObjectType<'MediaExternalLink', {
  /** The id of the external link */
  id: Field<Scalar_Int>
  /** The url of the external link or base url of link source */
  url: Field<Scalar_String | null>
  /** The links website site name */
  site: Field<Scalar_String>
  /** The links website site id */
  siteId: Field<Scalar_Int | null>
  type: Field<Enum_ExternalLinkType | null>
  /** Language the site content is in. See Staff language field for values. */
  language: Field<Scalar_String | null>
  color: Field<Scalar_String | null>
  /** The icon image url of the site. Not available for all links. Transparent PNG 64x64 */
  icon: Field<Scalar_String | null>
  notes: Field<Scalar_String | null>
  isDisabled: Field<Scalar_Boolean | null>
}>

/** Data and links to legal streaming episodes on external sites */
type Type_MediaStreamingEpisode = ObjectType<'MediaStreamingEpisode', {
  /** Title of the episode */
  title: Field<Scalar_String | null>
  /** Url of episode image thumbnail */
  thumbnail: Field<Scalar_String | null>
  /** The url of the episode */
  url: Field<Scalar_String | null>
  /** The site location of the streaming episodes */
  site: Field<Scalar_String | null>
}>

/** The ranking of a media in a particular time span and format compared to other media */
type Type_MediaRank = ObjectType<'MediaRank', {
  /** The id of the rank */
  id: Field<Scalar_Int>
  /** The numerical rank of the media */
  rank: Field<Scalar_Int>
  /** The type of ranking */
  type: Field<Enum_MediaRankType>
  /** The format the media is ranked within */
  format: Field<Enum_MediaFormat>
  /** The year the media is ranked within */
  year: Field<Scalar_Int | null>
  /** The season the media is ranked within */
  season: Field<Enum_MediaSeason | null>
  /** If the ranking is based on all time instead of a season/year */
  allTime: Field<Scalar_Boolean | null>
  /** String that gives context to the ranking type and time span */
  context: Field<Scalar_String>
}>

/** List of anime or manga */
type Type_MediaList = ObjectType<'MediaList', {
  /** The id of the list entry */
  id: Field<Scalar_Int>
  /** The id of the user owner of the list entry */
  userId: Field<Scalar_Int>
  /** The id of the media */
  mediaId: Field<Scalar_Int>
  /** The watching/reading status */
  status: Field<Enum_MediaListStatus | null>
  /** The score of the entry */
  score: Field<Scalar_Float | null, {
    format: Input<Enum_ScoreFormat | null>
  }>
  /** The amount of episodes/chapters consumed by the user */
  progress: Field<Scalar_Int | null>
  /** The amount of volumes read by the user */
  progressVolumes: Field<Scalar_Int | null>
  /** The amount of times the user has rewatched/read the media */
  repeat: Field<Scalar_Int | null>
  /** Priority of planning */
  priority: Field<Scalar_Int | null>
  /** If the entry should only be visible to authenticated user */
  private: Field<Scalar_Boolean | null>
  /** Text notes */
  notes: Field<Scalar_String | null>
  /** If the entry shown be hidden from non-custom lists */
  hiddenFromStatusLists: Field<Scalar_Boolean | null>
  /** Map of booleans for which custom lists the entry are in */
  customLists: Field<Scalar_Json | null, {
    asArray: Input<Scalar_Boolean | null>
  }>
  /** Map of advanced scores with name keys */
  advancedScores: Field<Scalar_Json | null>
  /** When the entry was started by the user */
  startedAt: Field<Type_FuzzyDate | null>
  /** When the entry was completed by the user */
  completedAt: Field<Type_FuzzyDate | null>
  /** When the entry data was last updated */
  updatedAt: Field<Scalar_Int | null>
  /** When the entry data was created */
  createdAt: Field<Scalar_Int | null>
  media: Field<Type_Media | null>
  user: Field<Type_User | null>
}>

type Type_ReviewConnection = ObjectType<'ReviewConnection', {
  edges: Field<(Type_ReviewEdge | null)[] | null>
  nodes: Field<(Type_Review | null)[] | null>
  /** The pagination information */
  pageInfo: Field<Type_PageInfo | null>
}>

/** Review connection edge */
type Type_ReviewEdge = ObjectType<'ReviewEdge', {
  node: Field<Type_Review | null>
}>

/** A Review that features in an anime or manga */
type Type_Review = ObjectType<'Review', {
  /** The id of the review */
  id: Field<Scalar_Int>
  /** The id of the review's creator */
  userId: Field<Scalar_Int>
  /** The id of the review's media */
  mediaId: Field<Scalar_Int>
  /** For which type of media the review is for */
  mediaType: Field<Enum_MediaType | null>
  /** A short summary of the review */
  summary: Field<Scalar_String | null>
  /** The main review body text */
  body: Field<Scalar_String | null, {
    asHtml: Input<Scalar_Boolean | null>
  }>
  /** The total user rating of the review */
  rating: Field<Scalar_Int | null>
  /** The amount of user ratings of the review */
  ratingAmount: Field<Scalar_Int | null>
  /** The rating of the review by currently authenticated user */
  userRating: Field<Enum_ReviewRating | null>
  /** The review score of the media */
  score: Field<Scalar_Int | null>
  /** If the review is not yet publicly published and is only viewable by creator */
  private: Field<Scalar_Boolean | null>
  /** The url for the review page on the AniList website */
  siteUrl: Field<Scalar_String | null>
  /** The time of the thread creation */
  createdAt: Field<Scalar_Int>
  /** The time of the thread last update */
  updatedAt: Field<Scalar_Int>
  /** The creator of the review */
  user: Field<Type_User | null>
  /** The media the review is of */
  media: Field<Type_Media | null>
}>

type Type_RecommendationConnection = ObjectType<'RecommendationConnection', {
  edges: Field<(Type_RecommendationEdge | null)[] | null>
  nodes: Field<(Type_Recommendation | null)[] | null>
  /** The pagination information */
  pageInfo: Field<Type_PageInfo | null>
}>

/** Recommendation connection edge */
type Type_RecommendationEdge = ObjectType<'RecommendationEdge', {
  node: Field<Type_Recommendation | null>
}>

/** Media recommendation */
type Type_Recommendation = ObjectType<'Recommendation', {
  /** The id of the recommendation */
  id: Field<Scalar_Int>
  /** Users rating of the recommendation */
  rating: Field<Scalar_Int | null>
  /** The rating of the recommendation by currently authenticated user */
  userRating: Field<Enum_RecommendationRating | null>
  /** The media the recommendation is from */
  media: Field<Type_Media | null>
  /** The recommended media */
  mediaRecommendation: Field<Type_Media | null>
  /** The user that first created the recommendation */
  user: Field<Type_User | null>
}>

/** A media's statistics */
type Type_MediaStats = ObjectType<'MediaStats', {
  scoreDistribution: Field<(Type_ScoreDistribution | null)[] | null>
  statusDistribution: Field<(Type_StatusDistribution | null)[] | null>
  /** @deprecated Replaced by MediaTrends */
  airingProgression: Field<(Type_AiringProgression | null)[] | null>
}>

/** A user's list score distribution. */
type Type_ScoreDistribution = ObjectType<'ScoreDistribution', {
  score: Field<Scalar_Int | null>
  /** The amount of list entries with this score */
  amount: Field<Scalar_Int | null>
}>

/** The distribution of the watching/reading status of media or a user's list */
type Type_StatusDistribution = ObjectType<'StatusDistribution', {
  /** The day the activity took place (Unix timestamp) */
  status: Field<Enum_MediaListStatus | null>
  /** The amount of entries with this status */
  amount: Field<Scalar_Int | null>
}>

/** Score & Watcher stats for airing anime by episode and mid-week */
type Type_AiringProgression = ObjectType<'AiringProgression', {
  /** The episode the stats were recorded at. .5 is the mid point between 2 episodes airing dates. */
  episode: Field<Scalar_Float | null>
  /** The average score for the media */
  score: Field<Scalar_Float | null>
  /** The amount of users watching the anime */
  watching: Field<Scalar_Int | null>
}>

type Type_UserStatisticTypes = ObjectType<'UserStatisticTypes', {
  anime: Field<Type_UserStatistics | null>
  manga: Field<Type_UserStatistics | null>
}>

type Type_UserStatistics = ObjectType<'UserStatistics', {
  count: Field<Scalar_Int>
  meanScore: Field<Scalar_Float>
  standardDeviation: Field<Scalar_Float>
  minutesWatched: Field<Scalar_Int>
  episodesWatched: Field<Scalar_Int>
  chaptersRead: Field<Scalar_Int>
  volumesRead: Field<Scalar_Int>
  formats: Field<(Type_UserFormatStatistic | null)[] | null, {
    limit: Input<Scalar_Int | null>
    sort: Input<(Enum_UserStatisticsSort | null)[] | null>
  }>
  statuses: Field<(Type_UserStatusStatistic | null)[] | null, {
    limit: Input<Scalar_Int | null>
    sort: Input<(Enum_UserStatisticsSort | null)[] | null>
  }>
  scores: Field<(Type_UserScoreStatistic | null)[] | null, {
    limit: Input<Scalar_Int | null>
    sort: Input<(Enum_UserStatisticsSort | null)[] | null>
  }>
  lengths: Field<(Type_UserLengthStatistic | null)[] | null, {
    limit: Input<Scalar_Int | null>
    sort: Input<(Enum_UserStatisticsSort | null)[] | null>
  }>
  releaseYears: Field<(Type_UserReleaseYearStatistic | null)[] | null, {
    limit: Input<Scalar_Int | null>
    sort: Input<(Enum_UserStatisticsSort | null)[] | null>
  }>
  startYears: Field<(Type_UserStartYearStatistic | null)[] | null, {
    limit: Input<Scalar_Int | null>
    sort: Input<(Enum_UserStatisticsSort | null)[] | null>
  }>
  genres: Field<(Type_UserGenreStatistic | null)[] | null, {
    limit: Input<Scalar_Int | null>
    sort: Input<(Enum_UserStatisticsSort | null)[] | null>
  }>
  tags: Field<(Type_UserTagStatistic | null)[] | null, {
    limit: Input<Scalar_Int | null>
    sort: Input<(Enum_UserStatisticsSort | null)[] | null>
  }>
  countries: Field<(Type_UserCountryStatistic | null)[] | null, {
    limit: Input<Scalar_Int | null>
    sort: Input<(Enum_UserStatisticsSort | null)[] | null>
  }>
  voiceActors: Field<(Type_UserVoiceActorStatistic | null)[] | null, {
    limit: Input<Scalar_Int | null>
    sort: Input<(Enum_UserStatisticsSort | null)[] | null>
  }>
  staff: Field<(Type_UserStaffStatistic | null)[] | null, {
    limit: Input<Scalar_Int | null>
    sort: Input<(Enum_UserStatisticsSort | null)[] | null>
  }>
  studios: Field<(Type_UserStudioStatistic | null)[] | null, {
    limit: Input<Scalar_Int | null>
    sort: Input<(Enum_UserStatisticsSort | null)[] | null>
  }>
}>

type Type_UserFormatStatistic = ObjectType<'UserFormatStatistic', {
  count: Field<Scalar_Int>
  meanScore: Field<Scalar_Float>
  minutesWatched: Field<Scalar_Int>
  chaptersRead: Field<Scalar_Int>
  mediaIds: Field<(Scalar_Int | null)[]>
  format: Field<Enum_MediaFormat | null>
}>

type Type_UserStatusStatistic = ObjectType<'UserStatusStatistic', {
  count: Field<Scalar_Int>
  meanScore: Field<Scalar_Float>
  minutesWatched: Field<Scalar_Int>
  chaptersRead: Field<Scalar_Int>
  mediaIds: Field<(Scalar_Int | null)[]>
  status: Field<Enum_MediaListStatus | null>
}>

type Type_UserScoreStatistic = ObjectType<'UserScoreStatistic', {
  count: Field<Scalar_Int>
  meanScore: Field<Scalar_Float>
  minutesWatched: Field<Scalar_Int>
  chaptersRead: Field<Scalar_Int>
  mediaIds: Field<(Scalar_Int | null)[]>
  score: Field<Scalar_Int | null>
}>

type Type_UserLengthStatistic = ObjectType<'UserLengthStatistic', {
  count: Field<Scalar_Int>
  meanScore: Field<Scalar_Float>
  minutesWatched: Field<Scalar_Int>
  chaptersRead: Field<Scalar_Int>
  mediaIds: Field<(Scalar_Int | null)[]>
  length: Field<Scalar_String | null>
}>

type Type_UserReleaseYearStatistic = ObjectType<'UserReleaseYearStatistic', {
  count: Field<Scalar_Int>
  meanScore: Field<Scalar_Float>
  minutesWatched: Field<Scalar_Int>
  chaptersRead: Field<Scalar_Int>
  mediaIds: Field<(Scalar_Int | null)[]>
  releaseYear: Field<Scalar_Int | null>
}>

type Type_UserStartYearStatistic = ObjectType<'UserStartYearStatistic', {
  count: Field<Scalar_Int>
  meanScore: Field<Scalar_Float>
  minutesWatched: Field<Scalar_Int>
  chaptersRead: Field<Scalar_Int>
  mediaIds: Field<(Scalar_Int | null)[]>
  startYear: Field<Scalar_Int | null>
}>

type Type_UserGenreStatistic = ObjectType<'UserGenreStatistic', {
  count: Field<Scalar_Int>
  meanScore: Field<Scalar_Float>
  minutesWatched: Field<Scalar_Int>
  chaptersRead: Field<Scalar_Int>
  mediaIds: Field<(Scalar_Int | null)[]>
  genre: Field<Scalar_String | null>
}>

type Type_UserTagStatistic = ObjectType<'UserTagStatistic', {
  count: Field<Scalar_Int>
  meanScore: Field<Scalar_Float>
  minutesWatched: Field<Scalar_Int>
  chaptersRead: Field<Scalar_Int>
  mediaIds: Field<(Scalar_Int | null)[]>
  tag: Field<Type_MediaTag | null>
}>

type Type_UserCountryStatistic = ObjectType<'UserCountryStatistic', {
  count: Field<Scalar_Int>
  meanScore: Field<Scalar_Float>
  minutesWatched: Field<Scalar_Int>
  chaptersRead: Field<Scalar_Int>
  mediaIds: Field<(Scalar_Int | null)[]>
  country: Field<Scalar_CountryCode | null>
}>

type Type_UserVoiceActorStatistic = ObjectType<'UserVoiceActorStatistic', {
  count: Field<Scalar_Int>
  meanScore: Field<Scalar_Float>
  minutesWatched: Field<Scalar_Int>
  chaptersRead: Field<Scalar_Int>
  mediaIds: Field<(Scalar_Int | null)[]>
  voiceActor: Field<Type_Staff | null>
  characterIds: Field<(Scalar_Int | null)[]>
}>

type Type_UserStaffStatistic = ObjectType<'UserStaffStatistic', {
  count: Field<Scalar_Int>
  meanScore: Field<Scalar_Float>
  minutesWatched: Field<Scalar_Int>
  chaptersRead: Field<Scalar_Int>
  mediaIds: Field<(Scalar_Int | null)[]>
  staff: Field<Type_Staff | null>
}>

type Type_UserStudioStatistic = ObjectType<'UserStudioStatistic', {
  count: Field<Scalar_Int>
  meanScore: Field<Scalar_Float>
  minutesWatched: Field<Scalar_Int>
  chaptersRead: Field<Scalar_Int>
  mediaIds: Field<(Scalar_Int | null)[]>
  studio: Field<Type_Studio | null>
}>

/** A user's statistics */
type Type_UserStats = ObjectType<'UserStats', {
  /** The amount of anime the user has watched in minutes */
  watchedTime: Field<Scalar_Int | null>
  /** The amount of manga chapters the user has read */
  chaptersRead: Field<Scalar_Int | null>
  activityHistory: Field<(Type_UserActivityHistory | null)[] | null>
  animeStatusDistribution: Field<(Type_StatusDistribution | null)[] | null>
  mangaStatusDistribution: Field<(Type_StatusDistribution | null)[] | null>
  animeScoreDistribution: Field<(Type_ScoreDistribution | null)[] | null>
  mangaScoreDistribution: Field<(Type_ScoreDistribution | null)[] | null>
  animeListScores: Field<Type_ListScoreStats | null>
  mangaListScores: Field<Type_ListScoreStats | null>
  favouredGenresOverview: Field<(Type_GenreStats | null)[] | null>
  favouredGenres: Field<(Type_GenreStats | null)[] | null>
  favouredTags: Field<(Type_TagStats | null)[] | null>
  favouredActors: Field<(Type_StaffStats | null)[] | null>
  favouredStaff: Field<(Type_StaffStats | null)[] | null>
  favouredStudios: Field<(Type_StudioStats | null)[] | null>
  favouredYears: Field<(Type_YearStats | null)[] | null>
  favouredFormats: Field<(Type_FormatStats | null)[] | null>
}>

/** A user's activity history stats. */
type Type_UserActivityHistory = ObjectType<'UserActivityHistory', {
  /** The day the activity took place (Unix timestamp) */
  date: Field<Scalar_Int | null>
  /** The amount of activity on the day */
  amount: Field<Scalar_Int | null>
  /** The level of activity represented on a 1-10 scale */
  level: Field<Scalar_Int | null>
}>

/** User's list score statistics */
type Type_ListScoreStats = ObjectType<'ListScoreStats', {
  meanScore: Field<Scalar_Int | null>
  standardDeviation: Field<Scalar_Int | null>
}>

/** User's genre statistics */
type Type_GenreStats = ObjectType<'GenreStats', {
  genre: Field<Scalar_String | null>
  amount: Field<Scalar_Int | null>
  meanScore: Field<Scalar_Int | null>
  /** The amount of time in minutes the genre has been watched by the user */
  timeWatched: Field<Scalar_Int | null>
}>

/** User's tag statistics */
type Type_TagStats = ObjectType<'TagStats', {
  tag: Field<Type_MediaTag | null>
  amount: Field<Scalar_Int | null>
  meanScore: Field<Scalar_Int | null>
  /** The amount of time in minutes the tag has been watched by the user */
  timeWatched: Field<Scalar_Int | null>
}>

/** User's staff statistics */
type Type_StaffStats = ObjectType<'StaffStats', {
  staff: Field<Type_Staff | null>
  amount: Field<Scalar_Int | null>
  meanScore: Field<Scalar_Int | null>
  /** The amount of time in minutes the staff member has been watched by the user */
  timeWatched: Field<Scalar_Int | null>
}>

/** User's studio statistics */
type Type_StudioStats = ObjectType<'StudioStats', {
  studio: Field<Type_Studio | null>
  amount: Field<Scalar_Int | null>
  meanScore: Field<Scalar_Int | null>
  /** The amount of time in minutes the studio's works have been watched by the user */
  timeWatched: Field<Scalar_Int | null>
}>

/** User's year statistics */
type Type_YearStats = ObjectType<'YearStats', {
  year: Field<Scalar_Int | null>
  amount: Field<Scalar_Int | null>
  meanScore: Field<Scalar_Int | null>
}>

/** User's format statistics */
type Type_FormatStats = ObjectType<'FormatStats', {
  format: Field<Enum_MediaFormat | null>
  amount: Field<Scalar_Int | null>
}>

/** A user's previous name */
type Type_UserPreviousName = ObjectType<'UserPreviousName', {
  /** A previous name of the user. */
  name: Field<Scalar_String | null>
  /** When the user first changed from this name. */
  createdAt: Field<Scalar_Int | null>
  /** When the user most recently changed from this name. */
  updatedAt: Field<Scalar_Int | null>
}>

/** Notification for when an episode of anime airs */
type Type_AiringNotification = ObjectType<'AiringNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the aired anime */
  animeId: Field<Scalar_Int>
  /** The episode number that just aired */
  episode: Field<Scalar_Int>
  /** The notification context text */
  contexts: Field<(Scalar_String | null)[] | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The associated media of the airing schedule */
  media: Field<Type_Media | null>
}>

/** Notification for when the authenticated user is followed by another user */
type Type_FollowingNotification = ObjectType<'FollowingNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The id of the user who followed the authenticated user */
  userId: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The notification context text */
  context: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The liked activity */
  user: Field<Type_User | null>
}>

/** Notification for when a user is send an activity message */
type Type_ActivityMessageNotification = ObjectType<'ActivityMessageNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The if of the user who send the message */
  userId: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the activity message */
  activityId: Field<Scalar_Int>
  /** The notification context text */
  context: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The message activity */
  message: Field<Type_MessageActivity | null>
  /** The user who sent the message */
  user: Field<Type_User | null>
}>

/** User message activity */
type Type_MessageActivity = ObjectType<'MessageActivity', {
  /** The id of the activity */
  id: Field<Scalar_Int>
  /** The user id of the activity's recipient */
  recipientId: Field<Scalar_Int | null>
  /** The user id of the activity's sender */
  messengerId: Field<Scalar_Int | null>
  /** The type of the activity */
  type: Field<Enum_ActivityType | null>
  /** The number of activity replies */
  replyCount: Field<Scalar_Int>
  /** The message text (Markdown) */
  message: Field<Scalar_String | null, {
    asHtml: Input<Scalar_Boolean | null>
  }>
  /** If the activity is locked and can receive replies */
  isLocked: Field<Scalar_Boolean | null>
  /** If the currently authenticated user is subscribed to the activity */
  isSubscribed: Field<Scalar_Boolean | null>
  /** The amount of likes the activity has */
  likeCount: Field<Scalar_Int>
  /** If the currently authenticated user liked the activity */
  isLiked: Field<Scalar_Boolean | null>
  /** If the activity is pinned to the top of the users activity feed */
  isPinned: Field<Scalar_Boolean | null>
  /** If the message is private and only viewable to the sender and recipients */
  isPrivate: Field<Scalar_Boolean | null>
  /** The url for the activity page on the AniList website */
  siteUrl: Field<Scalar_String | null>
  /** The time the activity was created at */
  createdAt: Field<Scalar_Int>
  /** The user who the activity message was sent to */
  recipient: Field<Type_User | null>
  /** The user who sent the activity message */
  messenger: Field<Type_User | null>
  /** The written replies to the activity */
  replies: Field<(Type_ActivityReply | null)[] | null>
  /** The users who liked the activity */
  likes: Field<(Type_User | null)[] | null>
}>

/** Replay to an activity item */
type Type_ActivityReply = ObjectType<'ActivityReply', {
  /** The id of the reply */
  id: Field<Scalar_Int>
  /** The id of the replies creator */
  userId: Field<Scalar_Int | null>
  /** The id of the parent activity */
  activityId: Field<Scalar_Int | null>
  /** The reply text */
  text: Field<Scalar_String | null, {
    asHtml: Input<Scalar_Boolean | null>
  }>
  /** The amount of likes the reply has */
  likeCount: Field<Scalar_Int>
  /** If the currently authenticated user liked the reply */
  isLiked: Field<Scalar_Boolean | null>
  /** The time the reply was created at */
  createdAt: Field<Scalar_Int>
  /** The user who created reply */
  user: Field<Type_User | null>
  /** The users who liked the reply */
  likes: Field<(Type_User | null)[] | null>
}>

/** Notification for when authenticated user is @ mentioned in activity or reply */
type Type_ActivityMentionNotification = ObjectType<'ActivityMentionNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The id of the user who mentioned the authenticated user */
  userId: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the activity where mentioned */
  activityId: Field<Scalar_Int>
  /** The notification context text */
  context: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The liked activity */
  activity: Field<Union_ActivityUnion | null>
  /** The user who mentioned the authenticated user */
  user: Field<Type_User | null>
}>

/** User text activity */
type Type_TextActivity = ObjectType<'TextActivity', {
  /** The id of the activity */
  id: Field<Scalar_Int>
  /** The user id of the activity's creator */
  userId: Field<Scalar_Int | null>
  /** The type of activity */
  type: Field<Enum_ActivityType | null>
  /** The number of activity replies */
  replyCount: Field<Scalar_Int>
  /** The status text (Markdown) */
  text: Field<Scalar_String | null, {
    asHtml: Input<Scalar_Boolean | null>
  }>
  /** The url for the activity page on the AniList website */
  siteUrl: Field<Scalar_String | null>
  /** If the activity is locked and can receive replies */
  isLocked: Field<Scalar_Boolean | null>
  /** If the currently authenticated user is subscribed to the activity */
  isSubscribed: Field<Scalar_Boolean | null>
  /** The amount of likes the activity has */
  likeCount: Field<Scalar_Int>
  /** If the currently authenticated user liked the activity */
  isLiked: Field<Scalar_Boolean | null>
  /** If the activity is pinned to the top of the users activity feed */
  isPinned: Field<Scalar_Boolean | null>
  /** The time the activity was created at */
  createdAt: Field<Scalar_Int>
  /** The user who created the activity */
  user: Field<Type_User | null>
  /** The written replies to the activity */
  replies: Field<(Type_ActivityReply | null)[] | null>
  /** The users who liked the activity */
  likes: Field<(Type_User | null)[] | null>
}>

/** User list activity (anime & manga updates) */
type Type_ListActivity = ObjectType<'ListActivity', {
  /** The id of the activity */
  id: Field<Scalar_Int>
  /** The user id of the activity's creator */
  userId: Field<Scalar_Int | null>
  /** The type of activity */
  type: Field<Enum_ActivityType | null>
  /** The number of activity replies */
  replyCount: Field<Scalar_Int>
  /** The list item's textual status */
  status: Field<Scalar_String | null>
  /** The list progress made */
  progress: Field<Scalar_String | null>
  /** If the activity is locked and can receive replies */
  isLocked: Field<Scalar_Boolean | null>
  /** If the currently authenticated user is subscribed to the activity */
  isSubscribed: Field<Scalar_Boolean | null>
  /** The amount of likes the activity has */
  likeCount: Field<Scalar_Int>
  /** If the currently authenticated user liked the activity */
  isLiked: Field<Scalar_Boolean | null>
  /** If the activity is pinned to the top of the users activity feed */
  isPinned: Field<Scalar_Boolean | null>
  /** The url for the activity page on the AniList website */
  siteUrl: Field<Scalar_String | null>
  /** The time the activity was created at */
  createdAt: Field<Scalar_Int>
  /** The owner of the activity */
  user: Field<Type_User | null>
  /** The associated media to the activity update */
  media: Field<Type_Media | null>
  /** The written replies to the activity */
  replies: Field<(Type_ActivityReply | null)[] | null>
  /** The users who liked the activity */
  likes: Field<(Type_User | null)[] | null>
}>

/** Notification for when a user replies to the authenticated users activity */
type Type_ActivityReplyNotification = ObjectType<'ActivityReplyNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The id of the user who replied to the activity */
  userId: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the activity which was replied too */
  activityId: Field<Scalar_Int>
  /** The notification context text */
  context: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The liked activity */
  activity: Field<Union_ActivityUnion | null>
  /** The user who replied to the activity */
  user: Field<Type_User | null>
}>

/** Notification for when a user replies to activity the authenticated user has replied to */
type Type_ActivityReplySubscribedNotification = ObjectType<'ActivityReplySubscribedNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The id of the user who replied to the activity */
  userId: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the activity which was replied too */
  activityId: Field<Scalar_Int>
  /** The notification context text */
  context: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The liked activity */
  activity: Field<Union_ActivityUnion | null>
  /** The user who replied to the activity */
  user: Field<Type_User | null>
}>

/** Notification for when a activity is liked */
type Type_ActivityLikeNotification = ObjectType<'ActivityLikeNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The id of the user who liked to the activity */
  userId: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the activity which was liked */
  activityId: Field<Scalar_Int>
  /** The notification context text */
  context: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The liked activity */
  activity: Field<Union_ActivityUnion | null>
  /** The user who liked the activity */
  user: Field<Type_User | null>
}>

/** Notification for when a activity reply is liked */
type Type_ActivityReplyLikeNotification = ObjectType<'ActivityReplyLikeNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The id of the user who liked to the activity reply */
  userId: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the activity where the reply which was liked */
  activityId: Field<Scalar_Int>
  /** The notification context text */
  context: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The liked activity */
  activity: Field<Union_ActivityUnion | null>
  /** The user who liked the activity reply */
  user: Field<Type_User | null>
}>

/** Notification for when authenticated user is @ mentioned in a forum thread comment */
type Type_ThreadCommentMentionNotification = ObjectType<'ThreadCommentMentionNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The id of the user who mentioned the authenticated user */
  userId: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the comment where mentioned */
  commentId: Field<Scalar_Int>
  /** The notification context text */
  context: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The thread that the relevant comment belongs to */
  thread: Field<Type_Thread | null>
  /** The thread comment that included the @ mention */
  comment: Field<Type_ThreadComment | null>
  /** The user who mentioned the authenticated user */
  user: Field<Type_User | null>
}>

/** Forum Thread */
type Type_Thread = ObjectType<'Thread', {
  /** The id of the thread */
  id: Field<Scalar_Int>
  /** The title of the thread */
  title: Field<Scalar_String | null>
  /** The text body of the thread (Markdown) */
  body: Field<Scalar_String | null, {
    asHtml: Input<Scalar_Boolean | null>
  }>
  /** The id of the thread owner user */
  userId: Field<Scalar_Int>
  /** The id of the user who most recently commented on the thread */
  replyUserId: Field<Scalar_Int | null>
  /** The id of the most recent comment on the thread */
  replyCommentId: Field<Scalar_Int | null>
  /** The number of comments on the thread */
  replyCount: Field<Scalar_Int | null>
  /** The number of times users have viewed the thread */
  viewCount: Field<Scalar_Int | null>
  /** If the thread is locked and can receive comments */
  isLocked: Field<Scalar_Boolean | null>
  /** If the thread is stickied and should be displayed at the top of the page */
  isSticky: Field<Scalar_Boolean | null>
  /** If the currently authenticated user is subscribed to the thread */
  isSubscribed: Field<Scalar_Boolean | null>
  /** The amount of likes the thread has */
  likeCount: Field<Scalar_Int>
  /** If the currently authenticated user liked the thread */
  isLiked: Field<Scalar_Boolean | null>
  /** The time of the last reply */
  repliedAt: Field<Scalar_Int | null>
  /** The time of the thread creation */
  createdAt: Field<Scalar_Int>
  /** The time of the thread last update */
  updatedAt: Field<Scalar_Int>
  /** The owner of the thread */
  user: Field<Type_User | null>
  /** The user to last reply to the thread */
  replyUser: Field<Type_User | null>
  /** The users who liked the thread */
  likes: Field<(Type_User | null)[] | null>
  /** The url for the thread page on the AniList website */
  siteUrl: Field<Scalar_String | null>
  /** The categories of the thread */
  categories: Field<(Type_ThreadCategory | null)[] | null>
  /** The media categories of the thread */
  mediaCategories: Field<(Type_Media | null)[] | null>
}>

/** A forum thread category */
type Type_ThreadCategory = ObjectType<'ThreadCategory', {
  /** The id of the category */
  id: Field<Scalar_Int>
  /** The name of the category */
  name: Field<Scalar_String>
}>

/** Forum Thread Comment */
type Type_ThreadComment = ObjectType<'ThreadComment', {
  /** The id of the comment */
  id: Field<Scalar_Int>
  /** The user id of the comment's owner */
  userId: Field<Scalar_Int | null>
  /** The id of thread the comment belongs to */
  threadId: Field<Scalar_Int | null>
  /** The text content of the comment (Markdown) */
  comment: Field<Scalar_String | null, {
    asHtml: Input<Scalar_Boolean | null>
  }>
  /** The amount of likes the comment has */
  likeCount: Field<Scalar_Int>
  /** If the currently authenticated user liked the comment */
  isLiked: Field<Scalar_Boolean | null>
  /** The url for the comment page on the AniList website */
  siteUrl: Field<Scalar_String | null>
  /** The time of the comments creation */
  createdAt: Field<Scalar_Int>
  /** The time of the comments last update */
  updatedAt: Field<Scalar_Int>
  /** The thread the comment belongs to */
  thread: Field<Type_Thread | null>
  /** The user who created the comment */
  user: Field<Type_User | null>
  /** The users who liked the comment */
  likes: Field<(Type_User | null)[] | null>
  /** The comment's child reply comments */
  childComments: Field<Scalar_Json | null>
  /** If the comment tree is locked and may not receive replies or edits */
  isLocked: Field<Scalar_Boolean | null>
}>

/** Notification for when a user replies to your forum thread comment */
type Type_ThreadCommentReplyNotification = ObjectType<'ThreadCommentReplyNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The id of the user who create the comment reply */
  userId: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the reply comment */
  commentId: Field<Scalar_Int>
  /** The notification context text */
  context: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The thread that the relevant comment belongs to */
  thread: Field<Type_Thread | null>
  /** The reply thread comment */
  comment: Field<Type_ThreadComment | null>
  /** The user who replied to the activity */
  user: Field<Type_User | null>
}>

/** Notification for when a user replies to a subscribed forum thread */
type Type_ThreadCommentSubscribedNotification = ObjectType<'ThreadCommentSubscribedNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The id of the user who commented on the thread */
  userId: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the new comment in the subscribed thread */
  commentId: Field<Scalar_Int>
  /** The notification context text */
  context: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The thread that the relevant comment belongs to */
  thread: Field<Type_Thread | null>
  /** The reply thread comment */
  comment: Field<Type_ThreadComment | null>
  /** The user who replied to the subscribed thread */
  user: Field<Type_User | null>
}>

/** Notification for when a thread comment is liked */
type Type_ThreadCommentLikeNotification = ObjectType<'ThreadCommentLikeNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The id of the user who liked to the activity */
  userId: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the activity which was liked */
  commentId: Field<Scalar_Int>
  /** The notification context text */
  context: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The thread that the relevant comment belongs to */
  thread: Field<Type_Thread | null>
  /** The thread comment that was liked */
  comment: Field<Type_ThreadComment | null>
  /** The user who liked the activity */
  user: Field<Type_User | null>
}>

/** Notification for when a thread is liked */
type Type_ThreadLikeNotification = ObjectType<'ThreadLikeNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The id of the user who liked to the activity */
  userId: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the thread which was liked */
  threadId: Field<Scalar_Int>
  /** The notification context text */
  context: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The thread that the relevant comment belongs to */
  thread: Field<Type_Thread | null>
  /** The liked thread comment */
  comment: Field<Type_ThreadComment | null>
  /** The user who liked the activity */
  user: Field<Type_User | null>
}>

/** Notification for when new media is added to the site */
type Type_RelatedMediaAdditionNotification = ObjectType<'RelatedMediaAdditionNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the new media */
  mediaId: Field<Scalar_Int>
  /** The notification context text */
  context: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The associated media of the airing schedule */
  media: Field<Type_Media | null>
}>

/** Notification for when a media entry's data was changed in a significant way impacting users' list tracking */
type Type_MediaDataChangeNotification = ObjectType<'MediaDataChangeNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the media that received data changes */
  mediaId: Field<Scalar_Int>
  /** The reason for the media data change */
  context: Field<Scalar_String | null>
  /** The reason for the media data change */
  reason: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The media that received data changes */
  media: Field<Type_Media | null>
}>

/** Notification for when a media entry is merged into another for a user who had it on their list */
type Type_MediaMergeNotification = ObjectType<'MediaMergeNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The id of the media that was merged into */
  mediaId: Field<Scalar_Int>
  /** The title of the deleted media */
  deletedMediaTitles: Field<(Scalar_String | null)[] | null>
  /** The reason for the media data change */
  context: Field<Scalar_String | null>
  /** The reason for the media merge */
  reason: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The media that was merged into */
  media: Field<Type_Media | null>
}>

/** Notification for when a media tracked in a user's list is deleted from the site */
type Type_MediaDeletionNotification = ObjectType<'MediaDeletionNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The title of the deleted media */
  deletedMediaTitle: Field<Scalar_String | null>
  /** The reason for the media deletion */
  context: Field<Scalar_String | null>
  /** The reason for the media deletion */
  reason: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
}>

/** Notification for when a media submission is accepted, partially accepted, or rejected */
type Type_MediaSubmissionUpdateNotification = ObjectType<'MediaSubmissionUpdateNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The notification context text */
  contexts: Field<(Scalar_String | null)[] | null>
  /** The status of the submission */
  status: Field<Scalar_String | null>
  /** The notes of the submission */
  notes: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The media that was created or modified. If this submission was to create a new media and it was rejected, this will be null. */
  media: Field<Type_Media | null>
  /** The title of the media that was submitted. If this submission was to edit an existing media, this will be null. */
  submittedTitle: Field<Scalar_String | null>
}>

/** Notification for when a staff submission is accepted, partially accepted, or rejected */
type Type_StaffSubmissionUpdateNotification = ObjectType<'StaffSubmissionUpdateNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The notification context text */
  contexts: Field<(Scalar_String | null)[] | null>
  /** The status of the submission */
  status: Field<Scalar_String | null>
  /** The notes of the submission */
  notes: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The staff that was modified. */
  staff: Field<Type_Staff | null>
}>

/** Notification for when a character submission is accepted, partially accepted, or rejected */
type Type_CharacterSubmissionUpdateNotification = ObjectType<'CharacterSubmissionUpdateNotification', {
  /** The id of the Notification */
  id: Field<Scalar_Int>
  /** The type of notification */
  type: Field<Enum_NotificationType | null>
  /** The notification context text */
  contexts: Field<(Scalar_String | null)[] | null>
  /** The status of the submission */
  status: Field<Scalar_String | null>
  /** The notes of the submission */
  notes: Field<Scalar_String | null>
  /** The time the notification was created at */
  createdAt: Field<Scalar_Int | null>
  /** The character that was modified. */
  character: Field<Type_Character | null>
}>

/** List of anime or manga */
type Type_MediaListCollection = ObjectType<'MediaListCollection', {
  /** Grouped media list entries */
  lists: Field<(Type_MediaListGroup | null)[] | null>
  /** The owner of the list */
  user: Field<Type_User | null>
  /** If there is another chunk */
  hasNextChunk: Field<Scalar_Boolean | null>
  /**
   * A map of media list entry arrays grouped by status
   * @deprecated Not GraphQL spec compliant, use lists field instead.
   */
  statusLists: Field<((Type_MediaList | null)[] | null)[] | null, {
    asArray: Input<Scalar_Boolean | null>
  }>
  /**
   * A map of media list entry arrays grouped by custom lists
   * @deprecated Not GraphQL spec compliant, use lists field instead.
   */
  customLists: Field<((Type_MediaList | null)[] | null)[] | null, {
    asArray: Input<Scalar_Boolean | null>
  }>
}>

/** List group of anime or manga entries */
type Type_MediaListGroup = ObjectType<'MediaListGroup', {
  /** Media list entries */
  entries: Field<(Type_MediaList | null)[] | null>
  name: Field<Scalar_String | null>
  isCustomList: Field<Scalar_Boolean | null>
  isSplitCompletedList: Field<Scalar_Boolean | null>
  status: Field<Enum_MediaListStatus | null>
}>

/** Provides the parsed markdown as html */
type Type_ParsedMarkdown = ObjectType<'ParsedMarkdown', {
  /** The parsed markdown as html */
  html: Field<Scalar_String | null>
}>

type Type_AniChartUser = ObjectType<'AniChartUser', {
  user: Field<Type_User | null>
  settings: Field<Scalar_Json | null>
  highlights: Field<Scalar_Json | null>
}>

type Type_SiteStatistics = ObjectType<'SiteStatistics', {
  users: Field<Type_SiteTrendConnection | null, {
    sort: Input<(Enum_SiteTrendSort | null)[] | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  anime: Field<Type_SiteTrendConnection | null, {
    sort: Input<(Enum_SiteTrendSort | null)[] | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  manga: Field<Type_SiteTrendConnection | null, {
    sort: Input<(Enum_SiteTrendSort | null)[] | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  characters: Field<Type_SiteTrendConnection | null, {
    sort: Input<(Enum_SiteTrendSort | null)[] | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  staff: Field<Type_SiteTrendConnection | null, {
    sort: Input<(Enum_SiteTrendSort | null)[] | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  studios: Field<Type_SiteTrendConnection | null, {
    sort: Input<(Enum_SiteTrendSort | null)[] | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
  reviews: Field<Type_SiteTrendConnection | null, {
    sort: Input<(Enum_SiteTrendSort | null)[] | null>
    page: Input<Scalar_Int | null>
    perPage: Input<Scalar_Int | null>
  }>
}>

type Type_SiteTrendConnection = ObjectType<'SiteTrendConnection', {
  edges: Field<(Type_SiteTrendEdge | null)[] | null>
  nodes: Field<(Type_SiteTrend | null)[] | null>
  /** The pagination information */
  pageInfo: Field<Type_PageInfo | null>
}>

/** Site trend connection edge */
type Type_SiteTrendEdge = ObjectType<'SiteTrendEdge', {
  node: Field<Type_SiteTrend | null>
}>

/** Daily site statistics */
type Type_SiteTrend = ObjectType<'SiteTrend', {
  /** The day the data was recorded (timestamp) */
  date: Field<Scalar_Int>
  count: Field<Scalar_Int>
  /** The change from yesterday */
  change: Field<Scalar_Int>
}>

type Type_Mutation = ObjectType<'Mutation', {
  UpdateUser: Field<Type_User | null, {
    about: Input<Scalar_String | null>
    titleLanguage: Input<Enum_UserTitleLanguage | null>
    displayAdultContent: Input<Scalar_Boolean | null>
    airingNotifications: Input<Scalar_Boolean | null>
    scoreFormat: Input<Enum_ScoreFormat | null>
    rowOrder: Input<Scalar_String | null>
    profileColor: Input<Scalar_String | null>
    donatorBadge: Input<Scalar_String | null>
    notificationOptions: Input<(Input_NotificationOptionInput | null)[] | null>
    timezone: Input<Scalar_String | null>
    activityMergeTime: Input<Scalar_Int | null>
    animeListOptions: Input<Input_MediaListOptionsInput | null>
    mangaListOptions: Input<Input_MediaListOptionsInput | null>
    staffNameLanguage: Input<Enum_UserStaffNameLanguage | null>
    restrictMessagesToFollowing: Input<Scalar_Boolean | null>
    disabledListActivity: Input<(Input_ListActivityOptionInput | null)[] | null>
  }>
  /** Create or update a media list entry */
  SaveMediaListEntry: Field<Type_MediaList | null, {
    id: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    status: Input<Enum_MediaListStatus | null>
    score: Input<Scalar_Float | null>
    scoreRaw: Input<Scalar_Int | null>
    progress: Input<Scalar_Int | null>
    progressVolumes: Input<Scalar_Int | null>
    repeat: Input<Scalar_Int | null>
    priority: Input<Scalar_Int | null>
    private: Input<Scalar_Boolean | null>
    notes: Input<Scalar_String | null>
    hiddenFromStatusLists: Input<Scalar_Boolean | null>
    customLists: Input<(Scalar_String | null)[] | null>
    advancedScores: Input<(Scalar_Float | null)[] | null>
    startedAt: Input<Input_FuzzyDateInput | null>
    completedAt: Input<Input_FuzzyDateInput | null>
  }>
  /** Update multiple media list entries to the same values */
  UpdateMediaListEntries: Field<(Type_MediaList | null)[] | null, {
    status: Input<Enum_MediaListStatus | null>
    score: Input<Scalar_Float | null>
    scoreRaw: Input<Scalar_Int | null>
    progress: Input<Scalar_Int | null>
    progressVolumes: Input<Scalar_Int | null>
    repeat: Input<Scalar_Int | null>
    priority: Input<Scalar_Int | null>
    private: Input<Scalar_Boolean | null>
    notes: Input<Scalar_String | null>
    hiddenFromStatusLists: Input<Scalar_Boolean | null>
    advancedScores: Input<(Scalar_Float | null)[] | null>
    startedAt: Input<Input_FuzzyDateInput | null>
    completedAt: Input<Input_FuzzyDateInput | null>
    ids: Input<(Scalar_Int | null)[] | null>
  }>
  /** Delete a media list entry */
  DeleteMediaListEntry: Field<Type_Deleted | null, {
    id: Input<Scalar_Int | null>
  }>
  /** Delete a custom list and remove the list entries from it */
  DeleteCustomList: Field<Type_Deleted | null, {
    customList: Input<Scalar_String | null>
    type: Input<Enum_MediaType | null>
  }>
  /** Create or update text activity for the currently authenticated user */
  SaveTextActivity: Field<Type_TextActivity | null, {
    id: Input<Scalar_Int | null>
    text: Input<Scalar_String | null>
    locked: Input<Scalar_Boolean | null>
  }>
  /** Create or update message activity for the currently authenticated user */
  SaveMessageActivity: Field<Type_MessageActivity | null, {
    id: Input<Scalar_Int | null>
    message: Input<Scalar_String | null>
    recipientId: Input<Scalar_Int | null>
    private: Input<Scalar_Boolean | null>
    locked: Input<Scalar_Boolean | null>
    asMod: Input<Scalar_Boolean | null>
  }>
  /** Update list activity (Mod Only) */
  SaveListActivity: Field<Type_ListActivity | null, {
    id: Input<Scalar_Int | null>
    locked: Input<Scalar_Boolean | null>
  }>
  /** Delete an activity item of the authenticated users */
  DeleteActivity: Field<Type_Deleted | null, {
    id: Input<Scalar_Int | null>
  }>
  /** Toggle activity to be pinned to the top of the user's activity feed */
  ToggleActivityPin: Field<Union_ActivityUnion | null, {
    id: Input<Scalar_Int | null>
    pinned: Input<Scalar_Boolean | null>
  }>
  /** Toggle the subscription of an activity item */
  ToggleActivitySubscription: Field<Union_ActivityUnion | null, {
    activityId: Input<Scalar_Int | null>
    subscribe: Input<Scalar_Boolean | null>
  }>
  /** Create or update an activity reply */
  SaveActivityReply: Field<Type_ActivityReply | null, {
    id: Input<Scalar_Int | null>
    activityId: Input<Scalar_Int | null>
    text: Input<Scalar_String | null>
    asMod: Input<Scalar_Boolean | null>
  }>
  /** Delete an activity reply of the authenticated users */
  DeleteActivityReply: Field<Type_Deleted | null, {
    id: Input<Scalar_Int | null>
  }>
  /**
   * Add or remove a like from a likeable type.
   *                           Returns all the users who liked the same model
   */
  ToggleLike: Field<(Type_User | null)[] | null, {
    id: Input<Scalar_Int | null>
    type: Input<Enum_LikeableType | null>
  }>
  /** Add or remove a like from a likeable type. */
  ToggleLikeV2: Field<Union_LikeableUnion | null, {
    id: Input<Scalar_Int | null>
    type: Input<Enum_LikeableType | null>
  }>
  /** Toggle the un/following of a user */
  ToggleFollow: Field<Type_User | null, {
    userId: Input<Scalar_Int | null>
  }>
  /** Favourite or unfavourite an anime, manga, character, staff member, or studio */
  ToggleFavourite: Field<Type_Favourites | null, {
    animeId: Input<Scalar_Int | null>
    mangaId: Input<Scalar_Int | null>
    characterId: Input<Scalar_Int | null>
    staffId: Input<Scalar_Int | null>
    studioId: Input<Scalar_Int | null>
  }>
  /** Update the order favourites are displayed in */
  UpdateFavouriteOrder: Field<Type_Favourites | null, {
    animeIds: Input<(Scalar_Int | null)[] | null>
    mangaIds: Input<(Scalar_Int | null)[] | null>
    characterIds: Input<(Scalar_Int | null)[] | null>
    staffIds: Input<(Scalar_Int | null)[] | null>
    studioIds: Input<(Scalar_Int | null)[] | null>
    animeOrder: Input<(Scalar_Int | null)[] | null>
    mangaOrder: Input<(Scalar_Int | null)[] | null>
    characterOrder: Input<(Scalar_Int | null)[] | null>
    staffOrder: Input<(Scalar_Int | null)[] | null>
    studioOrder: Input<(Scalar_Int | null)[] | null>
  }>
  /** Create or update a review */
  SaveReview: Field<Type_Review | null, {
    id: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    body: Input<Scalar_String | null>
    summary: Input<Scalar_String | null>
    score: Input<Scalar_Int | null>
    private: Input<Scalar_Boolean | null>
  }>
  /** Delete a review */
  DeleteReview: Field<Type_Deleted | null, {
    id: Input<Scalar_Int | null>
  }>
  /** Rate a review */
  RateReview: Field<Type_Review | null, {
    reviewId: Input<Scalar_Int | null>
    rating: Input<Enum_ReviewRating | null>
  }>
  /** Recommendation a media */
  SaveRecommendation: Field<Type_Recommendation | null, {
    mediaId: Input<Scalar_Int | null>
    mediaRecommendationId: Input<Scalar_Int | null>
    rating: Input<Enum_RecommendationRating | null>
  }>
  /** Create or update a forum thread */
  SaveThread: Field<Type_Thread | null, {
    id: Input<Scalar_Int | null>
    title: Input<Scalar_String | null>
    body: Input<Scalar_String | null>
    categories: Input<(Scalar_Int | null)[] | null>
    mediaCategories: Input<(Scalar_Int | null)[] | null>
    sticky: Input<Scalar_Boolean | null>
    locked: Input<Scalar_Boolean | null>
  }>
  /** Delete a thread */
  DeleteThread: Field<Type_Deleted | null, {
    id: Input<Scalar_Int | null>
  }>
  /** Toggle the subscription of a forum thread */
  ToggleThreadSubscription: Field<Type_Thread | null, {
    threadId: Input<Scalar_Int | null>
    subscribe: Input<Scalar_Boolean | null>
  }>
  /** Create or update a thread comment */
  SaveThreadComment: Field<Type_ThreadComment | null, {
    id: Input<Scalar_Int | null>
    threadId: Input<Scalar_Int | null>
    parentCommentId: Input<Scalar_Int | null>
    comment: Input<Scalar_String | null>
    locked: Input<Scalar_Boolean | null>
  }>
  /** Delete a thread comment */
  DeleteThreadComment: Field<Type_Deleted | null, {
    id: Input<Scalar_Int | null>
  }>
  UpdateAniChartSettings: Field<Scalar_Json | null, {
    titleLanguage: Input<Scalar_String | null>
    outgoingLinkProvider: Input<Scalar_String | null>
    theme: Input<Scalar_String | null>
    sort: Input<Scalar_String | null>
  }>
  UpdateAniChartHighlights: Field<Scalar_Json | null, {
    highlights: Input<(Input_AniChartHighlightInput | null)[] | null>
  }>
}>

/** Deleted data type */
type Type_Deleted = ObjectType<'Deleted', {
  /** If an item has been successfully deleted */
  deleted: Field<Scalar_Boolean | null>
}>

/** Page of data (Used for internal use only) */
type Type_InternalPage = ObjectType<'InternalPage', {
  mediaSubmissions: Field<(Type_MediaSubmission | null)[] | null, {
    mediaId: Input<Scalar_Int | null>
    submissionId: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    assigneeId: Input<Scalar_Int | null>
    status: Input<Enum_SubmissionStatus | null>
    type: Input<Enum_MediaType | null>
    sort: Input<(Enum_SubmissionSort | null)[] | null>
  }>
  characterSubmissions: Field<(Type_CharacterSubmission | null)[] | null, {
    characterId: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    assigneeId: Input<Scalar_Int | null>
    status: Input<Enum_SubmissionStatus | null>
    sort: Input<(Enum_SubmissionSort | null)[] | null>
  }>
  staffSubmissions: Field<(Type_StaffSubmission | null)[] | null, {
    staffId: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    assigneeId: Input<Scalar_Int | null>
    status: Input<Enum_SubmissionStatus | null>
    sort: Input<(Enum_SubmissionSort | null)[] | null>
  }>
  revisionHistory: Field<(Type_RevisionHistory | null)[] | null, {
    userId: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    characterId: Input<Scalar_Int | null>
    staffId: Input<Scalar_Int | null>
    studioId: Input<Scalar_Int | null>
  }>
  reports: Field<(Type_Report | null)[] | null, {
    reporterId: Input<Scalar_Int | null>
    reportedId: Input<Scalar_Int | null>
  }>
  modActions: Field<(Type_ModAction | null)[] | null, {
    userId: Input<Scalar_Int | null>
    modId: Input<Scalar_Int | null>
    modId_not: Input<Scalar_Int | null>
    modId_in: Input<(Scalar_Int | null)[] | null>
    modId_not_in: Input<(Scalar_Int | null)[] | null>
  }>
  userBlockSearch: Field<(Type_User | null)[] | null, {
    search: Input<Scalar_String | null>
  }>
  /** The pagination information */
  pageInfo: Field<Type_PageInfo | null>
  users: Field<(Type_User | null)[] | null, {
    id: Input<Scalar_Int | null>
    name: Input<Scalar_String | null>
    isModerator: Input<Scalar_Boolean | null>
    search: Input<Scalar_String | null>
    sort: Input<(Enum_UserSort | null)[] | null>
  }>
  media: Field<(Type_Media | null)[] | null, {
    id: Input<Scalar_Int | null>
    idMal: Input<Scalar_Int | null>
    startDate: Input<Scalar_FuzzyDateInt | null>
    endDate: Input<Scalar_FuzzyDateInt | null>
    season: Input<Enum_MediaSeason | null>
    seasonYear: Input<Scalar_Int | null>
    type: Input<Enum_MediaType | null>
    format: Input<Enum_MediaFormat | null>
    status: Input<Enum_MediaStatus | null>
    episodes: Input<Scalar_Int | null>
    duration: Input<Scalar_Int | null>
    chapters: Input<Scalar_Int | null>
    volumes: Input<Scalar_Int | null>
    isAdult: Input<Scalar_Boolean | null>
    genre: Input<Scalar_String | null>
    tag: Input<Scalar_String | null>
    minimumTagRank: Input<Scalar_Int | null>
    tagCategory: Input<Scalar_String | null>
    onList: Input<Scalar_Boolean | null>
    licensedBy: Input<Scalar_String | null>
    licensedById: Input<Scalar_Int | null>
    averageScore: Input<Scalar_Int | null>
    popularity: Input<Scalar_Int | null>
    source: Input<Enum_MediaSource | null>
    countryOfOrigin: Input<Scalar_CountryCode | null>
    isLicensed: Input<Scalar_Boolean | null>
    search: Input<Scalar_String | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    idMal_not: Input<Scalar_Int | null>
    idMal_in: Input<(Scalar_Int | null)[] | null>
    idMal_not_in: Input<(Scalar_Int | null)[] | null>
    startDate_greater: Input<Scalar_FuzzyDateInt | null>
    startDate_lesser: Input<Scalar_FuzzyDateInt | null>
    startDate_like: Input<Scalar_String | null>
    endDate_greater: Input<Scalar_FuzzyDateInt | null>
    endDate_lesser: Input<Scalar_FuzzyDateInt | null>
    endDate_like: Input<Scalar_String | null>
    format_in: Input<(Enum_MediaFormat | null)[] | null>
    format_not: Input<Enum_MediaFormat | null>
    format_not_in: Input<(Enum_MediaFormat | null)[] | null>
    status_in: Input<(Enum_MediaStatus | null)[] | null>
    status_not: Input<Enum_MediaStatus | null>
    status_not_in: Input<(Enum_MediaStatus | null)[] | null>
    episodes_greater: Input<Scalar_Int | null>
    episodes_lesser: Input<Scalar_Int | null>
    duration_greater: Input<Scalar_Int | null>
    duration_lesser: Input<Scalar_Int | null>
    chapters_greater: Input<Scalar_Int | null>
    chapters_lesser: Input<Scalar_Int | null>
    volumes_greater: Input<Scalar_Int | null>
    volumes_lesser: Input<Scalar_Int | null>
    genre_in: Input<(Scalar_String | null)[] | null>
    genre_not_in: Input<(Scalar_String | null)[] | null>
    tag_in: Input<(Scalar_String | null)[] | null>
    tag_not_in: Input<(Scalar_String | null)[] | null>
    tagCategory_in: Input<(Scalar_String | null)[] | null>
    tagCategory_not_in: Input<(Scalar_String | null)[] | null>
    licensedBy_in: Input<(Scalar_String | null)[] | null>
    licensedById_in: Input<(Scalar_Int | null)[] | null>
    averageScore_not: Input<Scalar_Int | null>
    averageScore_greater: Input<Scalar_Int | null>
    averageScore_lesser: Input<Scalar_Int | null>
    popularity_not: Input<Scalar_Int | null>
    popularity_greater: Input<Scalar_Int | null>
    popularity_lesser: Input<Scalar_Int | null>
    source_in: Input<(Enum_MediaSource | null)[] | null>
    sort: Input<(Enum_MediaSort | null)[] | null>
  }>
  characters: Field<(Type_Character | null)[] | null, {
    id: Input<Scalar_Int | null>
    isBirthday: Input<Scalar_Boolean | null>
    search: Input<Scalar_String | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    sort: Input<(Enum_CharacterSort | null)[] | null>
  }>
  staff: Field<(Type_Staff | null)[] | null, {
    id: Input<Scalar_Int | null>
    isBirthday: Input<Scalar_Boolean | null>
    search: Input<Scalar_String | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    sort: Input<(Enum_StaffSort | null)[] | null>
  }>
  studios: Field<(Type_Studio | null)[] | null, {
    id: Input<Scalar_Int | null>
    search: Input<Scalar_String | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    sort: Input<(Enum_StudioSort | null)[] | null>
  }>
  mediaList: Field<(Type_MediaList | null)[] | null, {
    id: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    userName: Input<Scalar_String | null>
    type: Input<Enum_MediaType | null>
    status: Input<Enum_MediaListStatus | null>
    mediaId: Input<Scalar_Int | null>
    isFollowing: Input<Scalar_Boolean | null>
    notes: Input<Scalar_String | null>
    startedAt: Input<Scalar_FuzzyDateInt | null>
    completedAt: Input<Scalar_FuzzyDateInt | null>
    compareWithAuthList: Input<Scalar_Boolean | null>
    userId_in: Input<(Scalar_Int | null)[] | null>
    status_in: Input<(Enum_MediaListStatus | null)[] | null>
    status_not_in: Input<(Enum_MediaListStatus | null)[] | null>
    status_not: Input<Enum_MediaListStatus | null>
    mediaId_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not_in: Input<(Scalar_Int | null)[] | null>
    notes_like: Input<Scalar_String | null>
    startedAt_greater: Input<Scalar_FuzzyDateInt | null>
    startedAt_lesser: Input<Scalar_FuzzyDateInt | null>
    startedAt_like: Input<Scalar_String | null>
    completedAt_greater: Input<Scalar_FuzzyDateInt | null>
    completedAt_lesser: Input<Scalar_FuzzyDateInt | null>
    completedAt_like: Input<Scalar_String | null>
    sort: Input<(Enum_MediaListSort | null)[] | null>
  }>
  airingSchedules: Field<(Type_AiringSchedule | null)[] | null, {
    id: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    episode: Input<Scalar_Int | null>
    airingAt: Input<Scalar_Int | null>
    notYetAired: Input<Scalar_Boolean | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not: Input<Scalar_Int | null>
    mediaId_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not_in: Input<(Scalar_Int | null)[] | null>
    episode_not: Input<Scalar_Int | null>
    episode_in: Input<(Scalar_Int | null)[] | null>
    episode_not_in: Input<(Scalar_Int | null)[] | null>
    episode_greater: Input<Scalar_Int | null>
    episode_lesser: Input<Scalar_Int | null>
    airingAt_greater: Input<Scalar_Int | null>
    airingAt_lesser: Input<Scalar_Int | null>
    sort: Input<(Enum_AiringSort | null)[] | null>
  }>
  mediaTrends: Field<(Type_MediaTrend | null)[] | null, {
    mediaId: Input<Scalar_Int | null>
    date: Input<Scalar_Int | null>
    trending: Input<Scalar_Int | null>
    averageScore: Input<Scalar_Int | null>
    popularity: Input<Scalar_Int | null>
    episode: Input<Scalar_Int | null>
    releasing: Input<Scalar_Boolean | null>
    mediaId_not: Input<Scalar_Int | null>
    mediaId_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not_in: Input<(Scalar_Int | null)[] | null>
    date_greater: Input<Scalar_Int | null>
    date_lesser: Input<Scalar_Int | null>
    trending_greater: Input<Scalar_Int | null>
    trending_lesser: Input<Scalar_Int | null>
    trending_not: Input<Scalar_Int | null>
    averageScore_greater: Input<Scalar_Int | null>
    averageScore_lesser: Input<Scalar_Int | null>
    averageScore_not: Input<Scalar_Int | null>
    popularity_greater: Input<Scalar_Int | null>
    popularity_lesser: Input<Scalar_Int | null>
    popularity_not: Input<Scalar_Int | null>
    episode_greater: Input<Scalar_Int | null>
    episode_lesser: Input<Scalar_Int | null>
    episode_not: Input<Scalar_Int | null>
    sort: Input<(Enum_MediaTrendSort | null)[] | null>
  }>
  notifications: Field<(Union_NotificationUnion | null)[] | null, {
    type: Input<Enum_NotificationType | null>
    resetNotificationCount: Input<Scalar_Boolean | null>
    type_in: Input<(Enum_NotificationType | null)[] | null>
  }>
  followers: Field<(Type_User | null)[] | null, {
    userId: Input<Scalar_Int>
    sort: Input<(Enum_UserSort | null)[] | null>
  }>
  following: Field<(Type_User | null)[] | null, {
    userId: Input<Scalar_Int>
    sort: Input<(Enum_UserSort | null)[] | null>
  }>
  activities: Field<(Union_ActivityUnion | null)[] | null, {
    id: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    messengerId: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    type: Input<Enum_ActivityType | null>
    isFollowing: Input<Scalar_Boolean | null>
    hasReplies: Input<Scalar_Boolean | null>
    hasRepliesOrTypeText: Input<Scalar_Boolean | null>
    createdAt: Input<Scalar_Int | null>
    id_not: Input<Scalar_Int | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    id_not_in: Input<(Scalar_Int | null)[] | null>
    userId_not: Input<Scalar_Int | null>
    userId_in: Input<(Scalar_Int | null)[] | null>
    userId_not_in: Input<(Scalar_Int | null)[] | null>
    messengerId_not: Input<Scalar_Int | null>
    messengerId_in: Input<(Scalar_Int | null)[] | null>
    messengerId_not_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not: Input<Scalar_Int | null>
    mediaId_in: Input<(Scalar_Int | null)[] | null>
    mediaId_not_in: Input<(Scalar_Int | null)[] | null>
    type_not: Input<Enum_ActivityType | null>
    type_in: Input<(Enum_ActivityType | null)[] | null>
    type_not_in: Input<(Enum_ActivityType | null)[] | null>
    createdAt_greater: Input<Scalar_Int | null>
    createdAt_lesser: Input<Scalar_Int | null>
    sort: Input<(Enum_ActivitySort | null)[] | null>
  }>
  activityReplies: Field<(Type_ActivityReply | null)[] | null, {
    id: Input<Scalar_Int | null>
    activityId: Input<Scalar_Int | null>
  }>
  threads: Field<(Type_Thread | null)[] | null, {
    id: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    replyUserId: Input<Scalar_Int | null>
    subscribed: Input<Scalar_Boolean | null>
    categoryId: Input<Scalar_Int | null>
    mediaCategoryId: Input<Scalar_Int | null>
    search: Input<Scalar_String | null>
    id_in: Input<(Scalar_Int | null)[] | null>
    sort: Input<(Enum_ThreadSort | null)[] | null>
  }>
  threadComments: Field<(Type_ThreadComment | null)[] | null, {
    id: Input<Scalar_Int | null>
    threadId: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    sort: Input<(Enum_ThreadCommentSort | null)[] | null>
  }>
  reviews: Field<(Type_Review | null)[] | null, {
    id: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    mediaType: Input<Enum_MediaType | null>
    sort: Input<(Enum_ReviewSort | null)[] | null>
  }>
  recommendations: Field<(Type_Recommendation | null)[] | null, {
    id: Input<Scalar_Int | null>
    mediaId: Input<Scalar_Int | null>
    mediaRecommendationId: Input<Scalar_Int | null>
    userId: Input<Scalar_Int | null>
    rating: Input<Scalar_Int | null>
    onList: Input<Scalar_Boolean | null>
    rating_greater: Input<Scalar_Int | null>
    rating_lesser: Input<Scalar_Int | null>
    sort: Input<(Enum_RecommendationSort | null)[] | null>
  }>
  likes: Field<(Type_User | null)[] | null, {
    likeableId: Input<Scalar_Int | null>
    type: Input<Enum_LikeableType | null>
  }>
}>

/** Media submission */
type Type_MediaSubmission = ObjectType<'MediaSubmission', {
  /** The id of the submission */
  id: Field<Scalar_Int>
  /** User submitter of the submission */
  submitter: Field<Type_User | null>
  /** Data Mod assigned to handle the submission */
  assignee: Field<Type_User | null>
  /** Status of the submission */
  status: Field<Enum_SubmissionStatus | null>
  submitterStats: Field<Scalar_Json | null>
  notes: Field<Scalar_String | null>
  source: Field<Scalar_String | null>
  changes: Field<(Scalar_String | null)[] | null>
  /** Whether the submission is locked */
  locked: Field<Scalar_Boolean | null>
  media: Field<Type_Media | null>
  submission: Field<Type_Media | null>
  characters: Field<(Type_MediaSubmissionComparison | null)[] | null>
  staff: Field<(Type_MediaSubmissionComparison | null)[] | null>
  studios: Field<(Type_MediaSubmissionComparison | null)[] | null>
  relations: Field<(Type_MediaEdge | null)[] | null>
  externalLinks: Field<(Type_MediaSubmissionComparison | null)[] | null>
  createdAt: Field<Scalar_Int | null>
}>

/** Media submission with comparison to current data */
type Type_MediaSubmissionComparison = ObjectType<'MediaSubmissionComparison', {
  submission: Field<Type_MediaSubmissionEdge | null>
  character: Field<Type_MediaCharacter | null>
  staff: Field<Type_StaffEdge | null>
  studio: Field<Type_StudioEdge | null>
  externalLink: Field<Type_MediaExternalLink | null>
}>

type Type_MediaSubmissionEdge = ObjectType<'MediaSubmissionEdge', {
  /** The id of the direct submission */
  id: Field<Scalar_Int | null>
  characterRole: Field<Enum_CharacterRole | null>
  staffRole: Field<Scalar_String | null>
  roleNotes: Field<Scalar_String | null>
  dubGroup: Field<Scalar_String | null>
  characterName: Field<Scalar_String | null>
  isMain: Field<Scalar_Boolean | null>
  character: Field<Type_Character | null>
  characterSubmission: Field<Type_Character | null>
  voiceActor: Field<Type_Staff | null>
  voiceActorSubmission: Field<Type_Staff | null>
  staff: Field<Type_Staff | null>
  staffSubmission: Field<Type_Staff | null>
  studio: Field<Type_Studio | null>
  externalLink: Field<Type_MediaExternalLink | null>
  media: Field<Type_Media | null>
}>

/** Internal - Media characters separated */
type Type_MediaCharacter = ObjectType<'MediaCharacter', {
  /** The id of the connection */
  id: Field<Scalar_Int | null>
  /** The characters role in the media */
  role: Field<Enum_CharacterRole | null>
  roleNotes: Field<Scalar_String | null>
  dubGroup: Field<Scalar_String | null>
  /** Media specific character name */
  characterName: Field<Scalar_String | null>
  /** The characters in the media voiced by the parent actor */
  character: Field<Type_Character | null>
  /** The voice actor of the character */
  voiceActor: Field<Type_Staff | null>
}>

/** A submission for a character that features in an anime or manga */
type Type_CharacterSubmission = ObjectType<'CharacterSubmission', {
  /** The id of the submission */
  id: Field<Scalar_Int>
  /** Character that the submission is referencing */
  character: Field<Type_Character | null>
  /** The character submission changes */
  submission: Field<Type_Character | null>
  /** Submitter for the submission */
  submitter: Field<Type_User | null>
  /** Data Mod assigned to handle the submission */
  assignee: Field<Type_User | null>
  /** Status of the submission */
  status: Field<Enum_SubmissionStatus | null>
  /** Inner details of submission status */
  notes: Field<Scalar_String | null>
  source: Field<Scalar_String | null>
  /** Whether the submission is locked */
  locked: Field<Scalar_Boolean | null>
  createdAt: Field<Scalar_Int | null>
}>

/** A submission for a staff that features in an anime or manga */
type Type_StaffSubmission = ObjectType<'StaffSubmission', {
  /** The id of the submission */
  id: Field<Scalar_Int>
  /** Staff that the submission is referencing */
  staff: Field<Type_Staff | null>
  /** The staff submission changes */
  submission: Field<Type_Staff | null>
  /** Submitter for the submission */
  submitter: Field<Type_User | null>
  /** Data Mod assigned to handle the submission */
  assignee: Field<Type_User | null>
  /** Status of the submission */
  status: Field<Enum_SubmissionStatus | null>
  /** Inner details of submission status */
  notes: Field<Scalar_String | null>
  source: Field<Scalar_String | null>
  /** Whether the submission is locked */
  locked: Field<Scalar_Boolean | null>
  createdAt: Field<Scalar_Int | null>
}>

/** Feed of mod edit activity */
type Type_RevisionHistory = ObjectType<'RevisionHistory', {
  /** The id of the media */
  id: Field<Scalar_Int>
  /** The action taken on the objects */
  action: Field<Enum_RevisionHistoryAction | null>
  /** A JSON object of the fields that changed */
  changes: Field<Scalar_Json | null>
  /** The user who made the edit to the object */
  user: Field<Type_User | null>
  /** The media the mod feed entry references */
  media: Field<Type_Media | null>
  /** The character the mod feed entry references */
  character: Field<Type_Character | null>
  /** The staff member the mod feed entry references */
  staff: Field<Type_Staff | null>
  /** The studio the mod feed entry references */
  studio: Field<Type_Studio | null>
  /** The external link source the mod feed entry references */
  externalLink: Field<Type_MediaExternalLink | null>
  /** When the mod feed entry was created */
  createdAt: Field<Scalar_Int | null>
}>

type Type_Report = ObjectType<'Report', {
  id: Field<Scalar_Int>
  reporter: Field<Type_User | null>
  reported: Field<Type_User | null>
  reason: Field<Scalar_String | null>
  /** When the entry data was created */
  createdAt: Field<Scalar_Int | null>
  cleared: Field<Scalar_Boolean | null>
}>

type Type_ModAction = ObjectType<'ModAction', {
  /** The id of the action */
  id: Field<Scalar_Int>
  user: Field<Type_User | null>
  mod: Field<Type_User | null>
  type: Field<Enum_ModActionType | null>
  objectId: Field<Scalar_Int | null>
  objectType: Field<Scalar_String | null>
  data: Field<Scalar_String | null>
  createdAt: Field<Scalar_Int>
}>

type Type_CharacterSubmissionConnection = ObjectType<'CharacterSubmissionConnection', {
  edges: Field<(Type_CharacterSubmissionEdge | null)[] | null>
  nodes: Field<(Type_CharacterSubmission | null)[] | null>
  /** The pagination information */
  pageInfo: Field<Type_PageInfo | null>
}>

/** CharacterSubmission connection edge */
type Type_CharacterSubmissionEdge = ObjectType<'CharacterSubmissionEdge', {
  node: Field<Type_CharacterSubmission | null>
  /** The characters role in the media */
  role: Field<Enum_CharacterRole | null>
  /** The voice actors of the character */
  voiceActors: Field<(Type_Staff | null)[] | null>
  /** The submitted voice actors of the character */
  submittedVoiceActors: Field<(Type_StaffSubmission | null)[] | null>
}>

/** User data for moderators */
type Type_UserModData = ObjectType<'UserModData', {
  alts: Field<(Type_User | null)[] | null>
  bans: Field<Scalar_Json | null>
  ip: Field<Scalar_Json | null>
  counts: Field<Scalar_Json | null>
  privacy: Field<Scalar_Int | null>
  email: Field<Scalar_String | null>
}>

/** Notification union type */
type Union_NotificationUnion = UnionType<'NotificationUnion', {
  AiringNotification: Type_AiringNotification
  FollowingNotification: Type_FollowingNotification
  ActivityMessageNotification: Type_ActivityMessageNotification
  ActivityMentionNotification: Type_ActivityMentionNotification
  ActivityReplyNotification: Type_ActivityReplyNotification
  ActivityReplySubscribedNotification: Type_ActivityReplySubscribedNotification
  ActivityLikeNotification: Type_ActivityLikeNotification
  ActivityReplyLikeNotification: Type_ActivityReplyLikeNotification
  ThreadCommentMentionNotification: Type_ThreadCommentMentionNotification
  ThreadCommentReplyNotification: Type_ThreadCommentReplyNotification
  ThreadCommentSubscribedNotification: Type_ThreadCommentSubscribedNotification
  ThreadCommentLikeNotification: Type_ThreadCommentLikeNotification
  ThreadLikeNotification: Type_ThreadLikeNotification
  RelatedMediaAdditionNotification: Type_RelatedMediaAdditionNotification
  MediaDataChangeNotification: Type_MediaDataChangeNotification
  MediaMergeNotification: Type_MediaMergeNotification
  MediaDeletionNotification: Type_MediaDeletionNotification
  MediaSubmissionUpdateNotification: Type_MediaSubmissionUpdateNotification
  StaffSubmissionUpdateNotification: Type_StaffSubmissionUpdateNotification
  CharacterSubmissionUpdateNotification: Type_CharacterSubmissionUpdateNotification
}>

/** Activity union type */
type Union_ActivityUnion = UnionType<'ActivityUnion', {
  TextActivity: Type_TextActivity
  ListActivity: Type_ListActivity
  MessageActivity: Type_MessageActivity
}>

/** Likeable union type */
type Union_LikeableUnion = UnionType<'LikeableUnion', {
  ListActivity: Type_ListActivity
  TextActivity: Type_TextActivity
  MessageActivity: Type_MessageActivity
  ActivityReply: Type_ActivityReply
  Thread: Type_Thread
  ThreadComment: Type_ThreadComment
}>

export type Schema = DefineSchema<{
  Json: Scalar_Json
  CountryCode: Scalar_CountryCode
  FuzzyDateInt: Scalar_FuzzyDateInt
  Int: Scalar_Int
  Float: Scalar_Float
  String: Scalar_String
  Boolean: Scalar_Boolean
  ID: Scalar_ID
  UserSort: Enum_UserSort
  UserTitleLanguage: Enum_UserTitleLanguage
  NotificationType: Enum_NotificationType
  UserStaffNameLanguage: Enum_UserStaffNameLanguage
  MediaListStatus: Enum_MediaListStatus
  ScoreFormat: Enum_ScoreFormat
  MediaType: Enum_MediaType
  MediaFormat: Enum_MediaFormat
  MediaStatus: Enum_MediaStatus
  MediaSeason: Enum_MediaSeason
  MediaSource: Enum_MediaSource
  CharacterSort: Enum_CharacterSort
  CharacterRole: Enum_CharacterRole
  MediaSort: Enum_MediaSort
  StaffLanguage: Enum_StaffLanguage
  StaffSort: Enum_StaffSort
  StudioSort: Enum_StudioSort
  MediaTrendSort: Enum_MediaTrendSort
  ExternalLinkType: Enum_ExternalLinkType
  MediaRankType: Enum_MediaRankType
  ReviewSort: Enum_ReviewSort
  ReviewRating: Enum_ReviewRating
  RecommendationSort: Enum_RecommendationSort
  RecommendationRating: Enum_RecommendationRating
  MediaRelation: Enum_MediaRelation
  UserStatisticsSort: Enum_UserStatisticsSort
  ModRole: Enum_ModRole
  MediaListSort: Enum_MediaListSort
  AiringSort: Enum_AiringSort
  ActivityType: Enum_ActivityType
  ActivitySort: Enum_ActivitySort
  ThreadSort: Enum_ThreadSort
  ThreadCommentSort: Enum_ThreadCommentSort
  LikeableType: Enum_LikeableType
  SiteTrendSort: Enum_SiteTrendSort
  ExternalLinkMediaType: Enum_ExternalLinkMediaType
  SubmissionStatus: Enum_SubmissionStatus
  SubmissionSort: Enum_SubmissionSort
  RevisionHistoryAction: Enum_RevisionHistoryAction
  ModActionType: Enum_ModActionType
  NotificationOptionInput: Input_NotificationOptionInput
  MediaListOptionsInput: Input_MediaListOptionsInput
  ListActivityOptionInput: Input_ListActivityOptionInput
  FuzzyDateInput: Input_FuzzyDateInput
  AniChartHighlightInput: Input_AniChartHighlightInput
  MediaTitleInput: Input_MediaTitleInput
  AiringScheduleInput: Input_AiringScheduleInput
  MediaExternalLinkInput: Input_MediaExternalLinkInput
  CharacterNameInput: Input_CharacterNameInput
  StaffNameInput: Input_StaffNameInput
  Query: Type_Query
  Page: Type_Page
  PageInfo: Type_PageInfo
  User: Type_User
  UserAvatar: Type_UserAvatar
  UserOptions: Type_UserOptions
  NotificationOption: Type_NotificationOption
  ListActivityOption: Type_ListActivityOption
  MediaListOptions: Type_MediaListOptions
  MediaListTypeOptions: Type_MediaListTypeOptions
  Favourites: Type_Favourites
  MediaConnection: Type_MediaConnection
  MediaEdge: Type_MediaEdge
  Media: Type_Media
  MediaTitle: Type_MediaTitle
  FuzzyDate: Type_FuzzyDate
  MediaTrailer: Type_MediaTrailer
  MediaCoverImage: Type_MediaCoverImage
  MediaTag: Type_MediaTag
  CharacterConnection: Type_CharacterConnection
  CharacterEdge: Type_CharacterEdge
  Character: Type_Character
  CharacterName: Type_CharacterName
  CharacterImage: Type_CharacterImage
  Staff: Type_Staff
  StaffName: Type_StaffName
  StaffImage: Type_StaffImage
  StaffRoleType: Type_StaffRoleType
  StaffConnection: Type_StaffConnection
  StaffEdge: Type_StaffEdge
  StudioConnection: Type_StudioConnection
  StudioEdge: Type_StudioEdge
  Studio: Type_Studio
  AiringSchedule: Type_AiringSchedule
  AiringScheduleConnection: Type_AiringScheduleConnection
  AiringScheduleEdge: Type_AiringScheduleEdge
  MediaTrendConnection: Type_MediaTrendConnection
  MediaTrendEdge: Type_MediaTrendEdge
  MediaTrend: Type_MediaTrend
  MediaExternalLink: Type_MediaExternalLink
  MediaStreamingEpisode: Type_MediaStreamingEpisode
  MediaRank: Type_MediaRank
  MediaList: Type_MediaList
  ReviewConnection: Type_ReviewConnection
  ReviewEdge: Type_ReviewEdge
  Review: Type_Review
  RecommendationConnection: Type_RecommendationConnection
  RecommendationEdge: Type_RecommendationEdge
  Recommendation: Type_Recommendation
  MediaStats: Type_MediaStats
  ScoreDistribution: Type_ScoreDistribution
  StatusDistribution: Type_StatusDistribution
  AiringProgression: Type_AiringProgression
  UserStatisticTypes: Type_UserStatisticTypes
  UserStatistics: Type_UserStatistics
  UserFormatStatistic: Type_UserFormatStatistic
  UserStatusStatistic: Type_UserStatusStatistic
  UserScoreStatistic: Type_UserScoreStatistic
  UserLengthStatistic: Type_UserLengthStatistic
  UserReleaseYearStatistic: Type_UserReleaseYearStatistic
  UserStartYearStatistic: Type_UserStartYearStatistic
  UserGenreStatistic: Type_UserGenreStatistic
  UserTagStatistic: Type_UserTagStatistic
  UserCountryStatistic: Type_UserCountryStatistic
  UserVoiceActorStatistic: Type_UserVoiceActorStatistic
  UserStaffStatistic: Type_UserStaffStatistic
  UserStudioStatistic: Type_UserStudioStatistic
  UserStats: Type_UserStats
  UserActivityHistory: Type_UserActivityHistory
  ListScoreStats: Type_ListScoreStats
  GenreStats: Type_GenreStats
  TagStats: Type_TagStats
  StaffStats: Type_StaffStats
  StudioStats: Type_StudioStats
  YearStats: Type_YearStats
  FormatStats: Type_FormatStats
  UserPreviousName: Type_UserPreviousName
  AiringNotification: Type_AiringNotification
  FollowingNotification: Type_FollowingNotification
  ActivityMessageNotification: Type_ActivityMessageNotification
  MessageActivity: Type_MessageActivity
  ActivityReply: Type_ActivityReply
  ActivityMentionNotification: Type_ActivityMentionNotification
  TextActivity: Type_TextActivity
  ListActivity: Type_ListActivity
  ActivityReplyNotification: Type_ActivityReplyNotification
  ActivityReplySubscribedNotification: Type_ActivityReplySubscribedNotification
  ActivityLikeNotification: Type_ActivityLikeNotification
  ActivityReplyLikeNotification: Type_ActivityReplyLikeNotification
  ThreadCommentMentionNotification: Type_ThreadCommentMentionNotification
  Thread: Type_Thread
  ThreadCategory: Type_ThreadCategory
  ThreadComment: Type_ThreadComment
  ThreadCommentReplyNotification: Type_ThreadCommentReplyNotification
  ThreadCommentSubscribedNotification: Type_ThreadCommentSubscribedNotification
  ThreadCommentLikeNotification: Type_ThreadCommentLikeNotification
  ThreadLikeNotification: Type_ThreadLikeNotification
  RelatedMediaAdditionNotification: Type_RelatedMediaAdditionNotification
  MediaDataChangeNotification: Type_MediaDataChangeNotification
  MediaMergeNotification: Type_MediaMergeNotification
  MediaDeletionNotification: Type_MediaDeletionNotification
  MediaSubmissionUpdateNotification: Type_MediaSubmissionUpdateNotification
  StaffSubmissionUpdateNotification: Type_StaffSubmissionUpdateNotification
  CharacterSubmissionUpdateNotification: Type_CharacterSubmissionUpdateNotification
  MediaListCollection: Type_MediaListCollection
  MediaListGroup: Type_MediaListGroup
  ParsedMarkdown: Type_ParsedMarkdown
  AniChartUser: Type_AniChartUser
  SiteStatistics: Type_SiteStatistics
  SiteTrendConnection: Type_SiteTrendConnection
  SiteTrendEdge: Type_SiteTrendEdge
  SiteTrend: Type_SiteTrend
  Mutation: Type_Mutation
  Deleted: Type_Deleted
  InternalPage: Type_InternalPage
  MediaSubmission: Type_MediaSubmission
  MediaSubmissionComparison: Type_MediaSubmissionComparison
  MediaSubmissionEdge: Type_MediaSubmissionEdge
  MediaCharacter: Type_MediaCharacter
  CharacterSubmission: Type_CharacterSubmission
  StaffSubmission: Type_StaffSubmission
  RevisionHistory: Type_RevisionHistory
  Report: Type_Report
  ModAction: Type_ModAction
  CharacterSubmissionConnection: Type_CharacterSubmissionConnection
  CharacterSubmissionEdge: Type_CharacterSubmissionEdge
  UserModData: Type_UserModData
  NotificationUnion: Union_NotificationUnion
  ActivityUnion: Union_ActivityUnion
  LikeableUnion: Union_LikeableUnion
}, 'sha256:1bf093a341dbdbf76f610e190ccbb4f1024e4ad2ecd258bcf504a246bdee0ac9'>

declare module 'gazania' {
  interface Schemas {
    'https://graphql.anilist.co': Schema
  }
}
