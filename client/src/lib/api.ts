import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/",
  credentials: "include",
  prepareHeaders: (headers) => {
    headers.set("Accept", "application/json");
    return headers;
  },
});

const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  return rawBaseQuery(args, api, extraOptions);
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    "User",
    "Partners",
    "Partner",
    "Capabilities",
    "PartnerCapabilities",
    "PartnerCapability",
    "Assessments",
    "Assessment",
    "Documents",
    "Artifacts",
    "VerticalConfigs",
    "Activities",
    "DeletedCapabilities",
    "Users",
    "Stats",
    "Resources",
    "Events",
  ],
  endpoints: (builder) => ({
    getUser: builder.query<AuthUser | null, void>({
      queryFn: async (_arg, _queryApi, _extraOptions, baseQuery) => {
        const result = await baseQuery("api/user");
        if (result.error && result.error.status === 401) {
          return { data: null };
        }
        if (result.error) {
          return { error: result.error };
        }
        return { data: result.data as AuthUser };
      },
      providesTags: ["User"],
    }),

    login: builder.mutation<AuthUser, { username: string; password: string }>({
      query: (body) => ({ url: "api/login", method: "POST", body }),
      invalidatesTags: ["User"],
    }),

    register: builder.mutation<any, RegisterPayload>({
      query: (body) => ({ url: "api/register", method: "POST", body }),
      invalidatesTags: ["User"],
    }),

    logout: builder.mutation<void, void>({
      query: () => ({ url: "api/logout", method: "POST" }),
      invalidatesTags: ["User"],
    }),

    getPartners: builder.query<any[], void>({
      query: () => "api/partners",
      providesTags: ["Partners"],
    }),

    getPartner: builder.query<any, string>({
      query: (id) => `api/partners/${id}`,
      providesTags: (_result, _err, id) => [{ type: "Partner", id }],
    }),

    createPartner: builder.mutation<any, any>({
      query: (body) => ({ url: "api/partners", method: "POST", body }),
      invalidatesTags: ["Partners", "User"],
    }),

    updatePartner: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({
        url: `api/partners/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _err, { id }) => [
        "Partners",
        { type: "Partner", id },
      ],
    }),

    deletePartner: builder.mutation<void, string>({
      query: (id) => ({ url: `api/partners/${id}`, method: "DELETE" }),
      invalidatesTags: ["Partners"],
    }),

    linkPartner: builder.mutation<any, { partnerId: string }>({
      query: (body) => ({
        url: "api/user/link-partner",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["User"],
    }),

    getCapabilities: builder.query<any[], void>({
      query: () => "api/capabilities",
      providesTags: ["Capabilities"],
    }),

    getPartnerCapabilities: builder.query<any[], void>({
      query: () => "api/partner-capabilities",
      providesTags: ["PartnerCapabilities"],
    }),

    getPartnerCapability: builder.query<any, string>({
      query: (id) => `api/partner-capabilities/${id}`,
      providesTags: (_result, _err, id) => [
        { type: "PartnerCapability", id },
      ],
    }),

    createPartnerCapability: builder.mutation<any, any>({
      query: (body) => ({
        url: "api/partner-capabilities",
        method: "POST",
        body,
      }),
      invalidatesTags: ["PartnerCapabilities"],
    }),

    updatePartnerCapability: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({
        url: `api/partner-capabilities/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _err, { id }) => [
        "PartnerCapabilities",
        { type: "PartnerCapability", id },
      ],
    }),

    updatePartnerCapabilityStatus: builder.mutation<
      any,
      { id: string; status: string }
    >({
      query: ({ id, status }) => ({
        url: `api/partner-capabilities/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: (_result, _err, { id }) => [
        "PartnerCapabilities",
        { type: "PartnerCapability", id },
      ],
    }),

    getAssessments: builder.query<any[], void>({
      query: () => "api/assessments",
      providesTags: ["Assessments"],
    }),

    getAssessment: builder.query<any, string>({
      query: (id) => `api/assessments/${id}`,
      providesTags: (_result, _err, id) => [{ type: "Assessment", id }],
    }),

    updateAssessment: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({
        url: `api/assessments/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _err, { id }) => [
        "Assessments",
        { type: "Assessment", id },
      ],
    }),

    getPartnerAssessments: builder.query<any[], string>({
      query: (partnerId) => `api/partners/${partnerId}/assessments`,
      providesTags: ["Assessments"],
    }),

    createAssessment: builder.mutation<any, { partnerId: string; data: any }>({
      query: ({ partnerId, data }) => ({
        url: `api/partners/${partnerId}/assessments`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Assessments"],
    }),

    getAssessmentReportCard: builder.query<any, string>({
      query: (id) => `api/assessments/${id}/report-card`,
      providesTags: (_result, _err, id) => [{ type: "Assessment", id }],
    }),

    getPartnerDocuments: builder.query<any[], string>({
      query: (partnerId) => `api/partners/${partnerId}/documents`,
      providesTags: ["Documents"],
    }),

    deleteDocument: builder.mutation<void, string>({
      query: (id) => ({ url: `api/documents/${id}`, method: "DELETE" }),
      invalidatesTags: ["Documents"],
    }),

    analyzeDocument: builder.mutation<any, string>({
      query: (id) => ({
        url: `api/documents/${id}/analyze`,
        method: "POST",
      }),
      invalidatesTags: ["Documents"],
    }),

    getArtifacts: builder.query<any[], string | void>({
      query: (vertical) =>
        vertical ? `api/artifacts?vertical=${vertical}` : "api/artifacts",
      providesTags: ["Artifacts"],
    }),

    getVerticalConfigs: builder.query<any[], void>({
      query: () => "api/vertical-configs",
      providesTags: ["VerticalConfigs"],
    }),

    getActivities: builder.query<any[], void>({
      query: () => "api/activities",
      providesTags: ["Activities"],
    }),

    getPartnerActivities: builder.query<any[], string>({
      query: (partnerId) => `api/partners/${partnerId}/activities`,
      providesTags: ["Activities"],
    }),

    getStats: builder.query<any, void>({
      query: () => "api/stats",
      providesTags: ["Stats"],
    }),

    samLookup: builder.mutation<any, { uei?: string; cage?: string; ein?: string }>({
      query: (body) => ({ url: "api/sam-lookup", method: "POST", body }),
    }),

    samSearch: builder.mutation<any, string>({
      query: (partnerId) => ({
        url: `api/partners/${partnerId}/sam-search`,
        method: "POST",
      }),
      invalidatesTags: ["Documents", "Assessments"],
    }),

    aiRecommendLevel: builder.mutation<any, any>({
      query: (body) => ({
        url: "api/ai-recommend-level",
        method: "POST",
        body,
      }),
    }),

    prerequisiteValidation: builder.mutation<
      any,
      { partnerId: string; data: any }
    >({
      query: ({ partnerId, data }) => ({
        url: `api/partners/${partnerId}/prerequisite-validation`,
        method: "POST",
        body: data,
      }),
    }),

    getUsers: builder.query<any[], void>({
      query: () => "api/users",
      providesTags: ["Users"],
    }),

    createUser: builder.mutation<any, any>({
      query: (body) => ({ url: "api/users", method: "POST", body }),
      invalidatesTags: ["Users"],
    }),

    deleteUser: builder.mutation<void, string>({
      query: (id) => ({ url: `api/users/${id}`, method: "DELETE" }),
      invalidatesTags: ["Users"],
    }),

    getSubCapabilities: builder.query<any[], string>({
      query: (capId) => `api/capabilities/${capId}/sub-capabilities`,
    }),

    sendFeedback: builder.mutation<any, { capabilityId: string; data: any }>({
      query: ({ capabilityId, data }) => ({
        url: `api/partner-capabilities/${capabilityId}/feedback`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_result, _err, { capabilityId }) => [
        { type: "PartnerCapability", id: capabilityId },
        "PartnerCapabilities",
      ],
    }),

    getFeedback: builder.query<any[], string>({
      query: (capabilityId) =>
        `api/partner-capabilities/${capabilityId}/feedback`,
      providesTags: (_result, _err, id) => [
        { type: "PartnerCapability", id },
      ],
    }),

    getAdminPartnerCapabilities: builder.query<any[], void>({
      query: () => "api/admin/partner-capabilities",
      providesTags: ["PartnerCapabilities"],
    }),

    getPartnerArtifacts: builder.query<any[], string>({
      query: (partnerId) => `api/partners/${partnerId}/partner-artifacts`,
      providesTags: ["Documents"],
    }),

    uploadDocument: builder.mutation<any, { partnerId: string; formData: FormData }>({
      query: ({ partnerId, formData }) => ({
        url: `api/partners/${partnerId}/documents`,
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Documents"],
    }),

    approveDocument: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({
        url: `api/documents/${id}/approve`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["Documents"],
    }),

    createCapability: builder.mutation<any, any>({
      query: (body) => ({ url: "api/capabilities", method: "POST", body }),
      invalidatesTags: ["Capabilities"],
    }),

    updateCapability: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({
        url: `api/capabilities/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["Capabilities"],
    }),

    deleteCapability: builder.mutation<void, string>({
      query: (id) => ({ url: `api/capabilities/${id}`, method: "DELETE" }),
      invalidatesTags: ["Capabilities"],
    }),

    createSubCapability: builder.mutation<any, { capId: string; data: any }>({
      query: ({ capId, data }) => ({
        url: `api/capabilities/${capId}/sub-capabilities`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Capabilities"],
    }),

    updateSubCapability: builder.mutation<any, { capId: string; subId: string; data: any }>({
      query: ({ capId, subId, data }) => ({
        url: `api/capabilities/${capId}/sub-capabilities/${subId}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["Capabilities"],
    }),

    deleteSubCapability: builder.mutation<void, { capId: string; subId: string }>({
      query: ({ capId, subId }) => ({
        url: `api/capabilities/${capId}/sub-capabilities/${subId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Capabilities"],
    }),

    createVerticalConfig: builder.mutation<any, any>({
      query: (body) => ({ url: "api/vertical-configs", method: "POST", body }),
      invalidatesTags: ["VerticalConfigs"],
    }),

    createArtifact: builder.mutation<any, any>({
      query: (body) => ({ url: "api/artifacts", method: "POST", body }),
      invalidatesTags: ["Artifacts"],
    }),

    updateArtifact: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({
        url: `api/artifacts/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["Artifacts"],
    }),

    deleteArtifact: builder.mutation<void, string>({
      query: (id) => ({ url: `api/artifacts/${id}`, method: "DELETE" }),
      invalidatesTags: ["Artifacts"],
    }),

    deletePartnerCapability: builder.mutation<void, string>({
      query: (id) => ({
        url: `api/partner-capabilities/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["PartnerCapabilities", "DeletedCapabilities"],
    }),

    getDeletedPartnerCapabilities: builder.query<any[], void>({
      query: () => "api/partner-capabilities/deleted",
      providesTags: ["DeletedCapabilities"],
    }),

    restorePartnerCapability: builder.mutation<any, string>({
      query: (id) => ({
        url: `api/partner-capabilities/${id}/restore`,
        method: "PATCH",
      }),
      invalidatesTags: ["PartnerCapabilities", "DeletedCapabilities"],
    }),

    uploadCapabilityFile: builder.mutation<any, FormData>({
      query: (formData) => ({
        url: "api/capability-uploads",
        method: "POST",
        body: formData,
      }),
    }),

    gapAdvisor: builder.mutation<any, { partnerId: string; data: any }>({
      query: ({ partnerId, data }) => ({
        url: `api/partners/${partnerId}/gap-advisor`,
        method: "POST",
        body: data,
      }),
    }),

    getResources: builder.query<any[], void>({
      query: () => "api/resources",
      providesTags: ["Resources"],
    }),

    createResource: builder.mutation<any, FormData>({
      query: (formData) => ({
        url: "api/resources",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Resources"],
    }),

    deleteResource: builder.mutation<void, string>({
      query: (id) => ({ url: `api/resources/${id}`, method: "DELETE" }),
      invalidatesTags: ["Resources"],
    }),

    getEvents: builder.query<any[], void>({
      query: () => "api/events",
      providesTags: ["Events"],
    }),

    createEvent: builder.mutation<any, FormData>({
      query: (formData) => ({ url: "api/events", method: "POST", body: formData }),
      invalidatesTags: ["Events"],
    }),

    updateEvent: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({ url: `api/events/${id}`, method: "PATCH", body: data }),
      invalidatesTags: ["Events"],
    }),

    deleteEvent: builder.mutation<void, string>({
      query: (id) => ({ url: `api/events/${id}`, method: "DELETE" }),
      invalidatesTags: ["Events"],
    }),
  }),
});

export interface AuthUser {
  id: string;
  username: string;
  role: "admin" | "partner";
  partnerId: string | null;
  displayName: string | null;
}

interface RegisterPayload {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  companyName: string;
}

export const {
  useGetUserQuery,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useGetPartnersQuery,
  useGetPartnerQuery,
  useCreatePartnerMutation,
  useUpdatePartnerMutation,
  useDeletePartnerMutation,
  useLinkPartnerMutation,
  useGetCapabilitiesQuery,
  useGetPartnerCapabilitiesQuery,
  useGetPartnerCapabilityQuery,
  useCreatePartnerCapabilityMutation,
  useUpdatePartnerCapabilityMutation,
  useUpdatePartnerCapabilityStatusMutation,
  useGetAssessmentsQuery,
  useGetAssessmentQuery,
  useUpdateAssessmentMutation,
  useGetPartnerAssessmentsQuery,
  useCreateAssessmentMutation,
  useGetAssessmentReportCardQuery,
  useGetPartnerDocumentsQuery,
  useDeleteDocumentMutation,
  useAnalyzeDocumentMutation,
  useGetArtifactsQuery,
  useGetVerticalConfigsQuery,
  useGetActivitiesQuery,
  useGetPartnerActivitiesQuery,
  useGetStatsQuery,
  useSamLookupMutation,
  useSamSearchMutation,
  useAiRecommendLevelMutation,
  usePrerequisiteValidationMutation,
  useGetUsersQuery,
  useCreateUserMutation,
  useDeleteUserMutation,
  useGetSubCapabilitiesQuery,
  useSendFeedbackMutation,
  useGetFeedbackQuery,
  useGetAdminPartnerCapabilitiesQuery,
  useGetPartnerArtifactsQuery,
  useUploadDocumentMutation,
  useApproveDocumentMutation,
  useCreateCapabilityMutation,
  useUpdateCapabilityMutation,
  useDeleteCapabilityMutation,
  useCreateSubCapabilityMutation,
  useUpdateSubCapabilityMutation,
  useDeleteSubCapabilityMutation,
  useCreateVerticalConfigMutation,
  useCreateArtifactMutation,
  useUpdateArtifactMutation,
  useDeleteArtifactMutation,
  useDeletePartnerCapabilityMutation,
  useGetDeletedPartnerCapabilitiesQuery,
  useRestorePartnerCapabilityMutation,
  useUploadCapabilityFileMutation,
  useGapAdvisorMutation,
  useGetResourcesQuery,
  useCreateResourceMutation,
  useDeleteResourceMutation,
  useGetEventsQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
} = api;

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res;
}
