package service

import (
    "context"
    "strings"
    "time"

    "connectrpc.com/connect"

    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/eventtypes"
    pbtypes "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
    "github.com/awslabs/filemoverexpress/utils"
)

func (*FileMoverServer) ListEvents(
    _ context.Context,
    req *connect.Request[pbtypes.ListEventsRequest],
    clientStream *connect.ServerStream[pbtypes.ListEventsResponse],
) error {
    remoteAddr := req.Peer()
    if isLocalClient(remoteAddr) {
        events.Events.Info("New connection from local client")
    } else {
        events.Events.Info("New connection from %s", remoteAddr)
    }

    eventsChannel := make(chan eventtypes.Event, EventBufferSize)
    listenerId, err := utils.Sha256Hash(strings.Join([]string{remoteAddr.Addr, time.Now().String()}, "-"))
    if err != nil {
        return err
    }

    err = events.Events.RegisterListener(listenerId, eventsChannel, eventtypes.AllEvents)
    if err != nil {
        logger.Error("Failed to register GRPC events listener: %s", err)
        return err
    }

    defer destroyListener(listenerId)

    metadataEvent := getMetadataInfo(clientStream.Conn().Peer())
    mdEvt, mdEvtType := metadataEvent.ToProtobuf()
    err = clientStream.Send(&pbtypes.ListEventsResponse{
        EventType: mdEvtType,
        Event:     mdEvt,
    })
    if err != nil {
        events.Events.Error("Failed sending metadata event: %s", err.Error())
        return err
    }

    for evt := range eventsChannel {
        if err = handleEvent(clientStream, evt); err != nil {
            return err
        }
    }
    events.Events.Info("Closed connection to %s", remoteAddr)
    return nil
}

func handleEvent(clientStream *connect.ServerStream[pbtypes.ListEventsResponse], evt eventtypes.Event) error {
    var resp pbtypes.ListEventsResponse
    msgEvent, evtType := evt.ToProtobuf()

    if evtType == pbtypes.EventType_EVENT_TYPE_CONFIGURATION_UPDATE_EVENT_TYPE {
        metadataEvent := getMetadataInfo(clientStream.Conn().Peer())
        msgEvent, evtType = metadataEvent.ToProtobuf()
        resp = pbtypes.ListEventsResponse{
            EventType: evtType,
            Event:     msgEvent,
        }
    } else {
        resp = pbtypes.ListEventsResponse{
            EventType: evtType,
            Event:     msgEvent,
        }
    }

    if sendErr := clientStream.Send(&resp); sendErr != nil {
        // TODO Fix this string
        logger.Debug(strGrpcSendFailed, sendErr.Error())
        return sendErr
    }

    return nil
}
